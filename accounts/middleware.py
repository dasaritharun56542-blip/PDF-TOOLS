from django.contrib.sessions.models import Session
from django.contrib.auth.models import User
from django.utils.deprecation import MiddlewareMixin

class HeaderSessionAuthMiddleware(MiddlewareMixin):
    """
    Enterprise Cross-Site Session Authenticator.
    If modern browsers block third-party cookies from Render on Vercel,
    this middleware checks for X-Session-Key, Authorization, or GET params
    and seamlessly attaches the authenticated user to request.user.
    """
    def process_request(self, request):
        if getattr(request, 'user', None) and request.user.is_authenticated:
            return

        session_key = (
            request.headers.get('X-Session-Key') or
            request.GET.get('session_key') or
            request.COOKIES.get('pdf_powerhouse_session_key') or
            request.COOKIES.get('sessionid')
        )
        if not session_key:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                session_key = auth_header.split(' ', 1)[1].strip()

        if session_key:
            try:
                session_obj = Session.objects.using('default').filter(session_key=session_key).first()
                if session_obj:
                    data = session_obj.get_decoded()
                    user_id = data.get('_auth_user_id')
                    if user_id:
                        user = User.objects.using('default').filter(pk=user_id).first()
                        if user:
                            request.user = user
            except Exception:
                pass
