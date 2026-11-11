"""Bounded, scalar, same-row formulas; no Python eval or object access.

Language: scalar literals, column identifiers and col("name or id"), + - * / %,
comparisons, and/or/not, conditional expressions, and IF, abs, round, min, max,
len, lower, upper, concat, coalesce. IF/conditionals are lazy. Missing values
are None. Errors are explicit FormulaError; callers expose a null computed value
and a separate formula_errors entry. Formulas cannot read another row.
"""
import ast
import math
import operator


class FormulaError(ValueError):
    pass


MAX_SOURCE = 1024
MAX_NODES = 128
MAX_DEPTH = 20
MAX_TEXT = 10000
MAX_NUMBER = 1e15
FUNCTIONS = frozenset({'col', 'IF', 'abs', 'round', 'min', 'max', 'len', 'lower', 'upper', 'concat', 'coalesce'})
BINOPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
          ast.Div: operator.truediv, ast.Mod: operator.mod}
CMPOPS = {ast.Eq: operator.eq, ast.NotEq: operator.ne, ast.Lt: operator.lt,
          ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge}


def _scalar(value):
    if value is None or type(value) is bool:
        return value
    if type(value) in (int, float):
        if not math.isfinite(value) or abs(value) > MAX_NUMBER:
            raise FormulaError('Formula numeric limit exceeded')
        return value
    if type(value) is str and len(value) <= MAX_TEXT:
        return value
    raise FormulaError('Formula values must be bounded scalars')


def _parse(source):
    if not isinstance(source, str) or not source or len(source) > MAX_SOURCE:
        raise FormulaError('Formula must contain 1–1024 characters')
    # Parenthesis-only nesting is erased by ast.parse, so bound that too.
    nesting = 0
    for char in source:
        if char == '(':
            nesting += 1
            if nesting > MAX_DEPTH:
                raise FormulaError('Formula nesting limit exceeded')
        elif char == ')':
            nesting -= 1
    try:
        tree = ast.parse(source, mode='eval')
    except (SyntaxError, ValueError, RecursionError) as exc:
        raise FormulaError('Invalid formula syntax') from exc
    if sum(1 for _ in ast.walk(tree)) > MAX_NODES:
        raise FormulaError('Formula node limit exceeded')
    return tree.body


def _check(node, refs, depth=0):
    if depth > MAX_DEPTH:
        raise FormulaError('Formula nesting limit exceeded')
    check = lambda child: _check(child, refs, depth + 1)
    if isinstance(node, ast.Constant):
        _scalar(node.value)
    elif isinstance(node, ast.Name):
        if node.id.startswith('_'):
            raise FormulaError('Private names are forbidden')
        refs.add(node.id)
    elif isinstance(node, ast.BinOp) and type(node.op) in BINOPS:
        check(node.left)
        check(node.right)
    elif isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub, ast.Not)):
        check(node.operand)
    elif isinstance(node, ast.BoolOp) and isinstance(node.op, (ast.And, ast.Or)):
        for value in node.values:
            check(value)
    elif isinstance(node, ast.Compare) and all(type(op) in CMPOPS for op in node.ops):
        check(node.left)
        for value in node.comparators:
            check(value)
    elif isinstance(node, ast.IfExp):
        for value in (node.test, node.body, node.orelse):
            check(value)
    elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FUNCTIONS and not node.keywords:
        name = node.func.id
        limits = {'col':(1,1), 'IF':(3,3), 'abs':(1,1), 'round':(1,2), 'min':(1,32), 'max':(1,32), 'len':(1,1), 'lower':(1,1), 'upper':(1,1), 'concat':(1,32), 'coalesce':(1,32)}
        low, high = limits[name]
        if not low <= len(node.args) <= high:
            raise FormulaError('Wrong number of function arguments')
        if name == 'col':
            if not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
                raise FormulaError('col requires a literal column name or id')
            refs.add(node.args[0].value)
        else:
            for value in node.args:
                check(value)
    else:
        raise FormulaError('Unsupported formula operation')


def dependencies(source):
    refs = set()
    _check(_parse(source), refs)
    return refs


def validate(source, allowed_names=None):
    refs = dependencies(source)
    if allowed_names is not None and refs - set(allowed_names):
        raise FormulaError('Unknown formula column: ' + ', '.join(sorted(refs - set(allowed_names))))
    return refs


def evaluate(source, values):
    tree = _parse(source)
    refs = set()
    _check(tree, refs)
    if refs - values.keys():
        raise FormulaError('Unknown formula column')

    def calc(node):
        if isinstance(node, ast.Constant):
            return _scalar(node.value)
        if isinstance(node, ast.Name):
            return _scalar(values[node.id])
        if isinstance(node, ast.BinOp):
            left, right = calc(node.left), calc(node.right)
            if isinstance(node.op, ast.Mult) and (isinstance(left, str) or isinstance(right, str)):
                text, count = (left, right) if isinstance(left, str) else (right, left)
                if type(count) is not int or count < 0 or len(text) * count > MAX_TEXT:
                    raise FormulaError('Formula string limit exceeded')
            if isinstance(node.op, ast.Mod) and isinstance(left, str):
                raise FormulaError('String formatting is unsupported')
            return _scalar(BINOPS[type(node.op)](left, right))
        if isinstance(node, ast.UnaryOp):
            value = calc(node.operand)
            return _scalar(not value if isinstance(node.op, ast.Not) else -value if isinstance(node.op, ast.USub) else +value)
        if isinstance(node, ast.BoolOp):
            result = None
            for value in node.values:
                result = calc(value)
                if isinstance(node.op, ast.And) and not result or isinstance(node.op, ast.Or) and result:
                    break
            return result
        if isinstance(node, ast.Compare):
            left = calc(node.left)
            for op, right_node in zip(node.ops, node.comparators):
                right = calc(right_node)
                if not CMPOPS[type(op)](left, right):
                    return False
                left = right
            return True
        if isinstance(node, ast.IfExp):
            return calc(node.body if calc(node.test) else node.orelse)
        name = node.func.id
        if name == 'col':
            return _scalar(values[node.args[0].value])
        if name == 'IF':
            return calc(node.args[1] if calc(node.args[0]) else node.args[2])
        args = [calc(arg) for arg in node.args]
        if name == 'coalesce':
            return next((x for x in args if x is not None), None)
        if name in ('lower', 'upper', 'len') and not isinstance(args[0], str):
            raise FormulaError(name + ' requires text')
        if name == 'concat':
            if sum(len(str(x)) for x in args) > MAX_TEXT:
                raise FormulaError('Formula string limit exceeded')
            result = ''.join('' if x is None else str(x) for x in args)
        elif name == 'round':
            if len(args) == 2 and (type(args[1]) is not int or not -15 <= args[1] <= 15):
                raise FormulaError('round precision must be between -15 and 15')
            result = round(*args)
        else:
            funcs = {'abs':abs, 'min':lambda *xs: min(xs), 'max':lambda *xs: max(xs), 'len':len, 'lower':str.lower, 'upper':str.upper}
            result = funcs[name](*args)
        return _scalar(result)

    try:
        return _scalar(calc(tree))
    except FormulaError:
        raise
    except (ArithmeticError, TypeError, ValueError, KeyError, RecursionError) as exc:
        raise FormulaError('Formula cannot compute these values') from exc
