import unittest
from workspace_plugin.formulas import FormulaError, evaluate, validate


class FormulaTests(unittest.TestCase):
    def test_arithmetic_and_same_row_columns(self):
        self.assertEqual(evaluate('price * quantity + col("Tax")', {'price': 3, 'quantity': 4, 'Tax': 2}), 14)
        self.assertEqual(evaluate('IF(done, upper(name), "pending")', {'done': True, 'name': 'hello'}), 'HELLO')
        self.assertEqual(evaluate('coalesce(missing, 5)', {'missing': None}), 5)
        self.assertEqual(evaluate('round(10 / 3, 2)', {}), 3.33)

    def test_no_code_or_cross_row_access(self):
        for source in ['__import__("os")', 'x.y', 'x[0]', '[x for x in y]', '2 ** 9999', 'lambda: 1']:
            with self.subTest(source=source), self.assertRaises(FormulaError):
                evaluate(source, {'x': 1})

    def test_limits_and_bad_values(self):
        for source in ['1 / 0', '"x" * 100000000', '1e309', '(' * 100 + '1' + ')' * 100, '1+' * 200 + '1']:
            with self.subTest(source=source), self.assertRaises(FormulaError):
                evaluate(source, {})
        with self.assertRaises(FormulaError):
            validate('unknown + 1', {'known'})
        with self.assertRaises(FormulaError):
            evaluate('x + 1', {'x': [1]})

    def test_lazy_condition(self):
        self.assertEqual(evaluate('IF(False, 1/0, 4)', {}), 4)
        self.assertEqual(evaluate('4 if True else 1/0', {}), 4)

    def test_comparison_boolean_string_functions_and_nulls(self):
        examples = [
            ('a < b and b <= 3', {'a':1,'b':2}, True),
            ('not done or n == 2', {'done':False,'n':3}, True),
            ('concat(lower(name), "!", coalesce(x, ""))', {'name':'HELLO','x':None}, 'hello!'),
            ('len("abcd") + abs(-2) + min(4, 3) + max(5, 6)', {}, 15),
            ('-5 % 3', {}, 1),
            ('col("unit price") * col("qty")', {'unit price':2.5,'qty':4}, 10),
        ]
        for expression, values, expected in examples:
            with self.subTest(expression=expression):
                self.assertEqual(evaluate(expression, values), expected)

    def test_argument_types_unknown_columns_and_unsafe_language(self):
        for expression in ['min()', 'IF(True, 1)', 'col(x)', 'lower(1)', 'round(1, 100)', 'foo', '1 << 2', 'f"{1}"', '{"x": 1}', 'open("x")', '"%999999999s" % "x"', 'True + None']:
            with self.subTest(expression=expression), self.assertRaises(FormulaError):
                evaluate(expression, {})
