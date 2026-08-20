from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialApp
from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Custom social account adapter to prevent MultipleObjectsReturned or DoesNotExist errors when DB SocialApp or settings APP are defined."""
    def get_login_redirect_url(self, request):
        from django.conf import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', '').rstrip('/')
        if hasattr(request, 'user') and request.user and request.user.is_authenticated:
            request.session.save()
        session_key = getattr(request.session, 'session_key', None)
        if not session_key:
            request.session.save()
            session_key = request.session.session_key
        if frontend_url:
            return f"{frontend_url}/dashboard?session_key={session_key}"
        return f"/dashboard?session_key={session_key}"

    def get_app(self, request, provider, client_id=None):
        import os
        if provider == 'google':
            cid = os.getenv('GOOGLE_CLIENT_ID', '').strip() or '635971381104-v3q2u69tim8oihrjrrcispfsvhjsjim4.apps.googleusercontent.com'
            secret = os.getenv('GOOGLE_CLIENT_SECRET', '').strip()
            try:
                db_app = SocialApp.objects.using('default').filter(provider='google').first()
                if db_app:
                    if not secret and db_app.secret:
                        secret = db_app.secret
                    if db_app.client_id and not os.getenv('GOOGLE_CLIENT_ID'):
                        cid = db_app.client_id
            except Exception:
                pass
            return SocialApp(provider='google', name='Google', client_id=cid, secret=secret)

        try:
            return super().get_app(request, provider=provider, client_id=client_id)
        except MultipleObjectsReturned:
            apps = self.list_apps(request, provider=provider, client_id=client_id)
            db_apps = [a for a in apps if getattr(a, 'id', None) is not None]
            if db_apps:
                return db_apps[0]
            return apps[0]
        except (ObjectDoesNotExist, SocialApp.DoesNotExist):
            apps = self.list_apps(request, provider=provider, client_id=client_id)
            if apps:
                return apps[0]
            return SocialApp(provider=provider, name=provider.capitalize(), client_id='dummy', secret='dummy')
