from django.urls import path
from . import views

from accounts import views as accounts_views

urlpatterns = [
    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('tool/<str:tool_slug>/', views.tool_detail, name='tool_detail'),
    path('process/<str:tool_slug>/', views.process_tool, name='process_tool'),
    path('process/', views.process_tool, name='process_tool_generic'),
    path('status/<uuid:task_id>/', views.get_status, name='get_status'),
    path('download/<int:file_id>/', views.download_file, name='download_file'),
    path('history/', views.history, name='history'),
    path('api/get-page-count/', views.get_page_count, name='get_page_count'),
    path('api/tool-info/<str:tool_slug>/', views.tool_info, name='tool_info'),
    path('api/auth-status/', accounts_views.auth_status, name='api_auth_status'),
    path('api/pricing-data/', accounts_views.pricing_data, name='api_pricing_data'),
    path('api/plan-details/', accounts_views.plan_details, name='api_plan_details'),
    path('api/payment-success-verify/', accounts_views.payment_success_verify, name='api_payment_success_verify'),
    path('api/dashboard-data/', views.api_dashboard_data, name='api_dashboard_data'),
    path('api/history-data/', views.api_history_data, name='api_history_data'),
    
    # Admin Storage APIs
    path('api/admin/storage-stats/', views.api_admin_storage_stats, name='api_admin_storage_stats'),
    path('api/admin/files/', views.api_admin_files_list, name='api_admin_files_list'),
    path('api/admin/files/preview/<str:category>/<int:file_id>/', views.api_admin_file_preview, name='api_admin_file_preview'),
    path('api/admin/files/delete/', views.api_admin_file_delete, name='api_admin_file_delete'),
]

