import os
import sys
import urllib.parse

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app import app as raw_app

class VercelPathMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get('type') == 'http':
            query_string = scope.get('query_string', b'').decode('utf-8')
            params = urllib.parse.parse_qs(query_string)
            if 'path' in params and params['path'][0]:
                scope['path'] = '/' + params['path'][0].lstrip('/')
                clean_parts = [f'{k}={v}' for k, vs in params.items() if k != 'path' for v in vs]
                scope['query_string'] = '&'.join(clean_parts).encode('utf-8')
            elif scope.get('path') in ('/api/index.py', '/api/index'):
                scope['path'] = '/'
        await self.app(scope, receive, send)

app = VercelPathMiddleware(raw_app)
