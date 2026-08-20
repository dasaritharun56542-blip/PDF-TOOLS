from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from core import views

urlpatterns = [
    # Public Admin Stealth Cloaking (Returns HTTP 404 to conceal admin existence)
    path('admin/', views.admin_stealth_404),
    path('admin/<path:subpath>', views.admin_stealth_404),
    path('admin/login/', views.admin_stealth_404),
    path('admin/dashboard/', views.admin_stealth_404),

    # Secret Owner Portal (Owner-Only Access)
    path('owner-portal-secret-manage-x89/', admin.site.urls),

    path('health/', views.health_check),
    path('api/health/', views.health_check),
    path('robots.txt', views.robots_txt),
    path('sitemap.xml', views.sitemap_xml),
    path('assets/<path:path>', views.serve_spa_asset),
    path('logo_circle.png', views.serve_spa_asset, {'path': 'logo_circle.png'}),
    path('favicon.ico', views.serve_spa_asset, {'path': 'favicon.ico'}),
    path('phonepe_qr.jpg', views.serve_spa_asset, {'path': 'phonepe_qr.jpg'}),
    path('', include('core.urls')),
    path('accounts/', include('accounts.urls')),
    path('accounts/', include('allauth.urls')),
]

handler404 = 'core.views.error_404'
handler500 = 'core.views.error_500'
