import os
import sys

# Add root directory to python path for seamless imports on Vercel
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app import app as raw_app

class VercelPathMiddleware:
    """
    Middleware for Vercel serverless:
    Restores the original requested URL path from Vercel's x-matched-path header.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            headers = dict(scope.get("headers", []))
            # Vercel supplies x-matched-path with the real user route
            matched_path = headers.get(b"x-matched-path")
            if matched_path:
                scope["path"] = matched_path.decode("utf-8").split("?")[0]
            elif scope.get("path") in ("/api/index.py", "/api/index"):
                scope["path"] = "/"
        await self.app(scope, receive, send)

app = VercelPathMiddleware(raw_app)

