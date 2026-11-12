"""Synthetic-host boundary for routers embedded outside real Hermes middleware.

The production plugin intentionally has no token dependency. Tests use this gate
at their mount to preserve host authentication assertions (including 401s), not
as a plugin-owned native execution grant.
"""
from fastapi import Request


def host_auth(request: Request):
    from hermes_cli.web_deps import late
    late('_require_token')(request)
