from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialApp
from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Custom social account adapter to prevent MultipleObjectsReturned or DoesNotExist errors when DB SocialApp or settings APP are defined."""
    def get_login_redirect_url(self, request):
        from django.conf import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        return f"{frontend_url}/dashboard"

    def get_app(self, request, provider, client_id=None):
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
