from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login_view, name='login'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('resend-otp/', views.resend_otp, name='resend_otp'),
    path('auth-status/', views.auth_status, name='auth_status'),
    path('api/auth-status/', views.auth_status, name='api_auth_status'),
    path('google-login/', views.google_auth_callback_api, name='google_login_api'),
    path('google-signup/', views.google_auth_callback_api, name='google_signup_api'),
    path('me/', views.get_me, name='get_me_api'),
    path('logout/', views.logout_view, name='logout'),
    path('pricing/', views.pricing, name='pricing'),
    path('create-checkout-session/', views.create_checkout_session, name='create_checkout_session'),
    path('payment-success/', views.payment_success, name='payment_success'),
    path('payment-cancel/', views.payment_cancel, name='payment_cancel'),
    path('setup-upi/', views.create_upi_payment, name='create_upi_payment'),
    path('update-txn/', views.phonepe_initiate_payment, name='phonepe_initiate_payment'), # backward compatibility link to pay
    path('webhook/', views.stripe_webhook, name='stripe_webhook'),
    path('phonepe/pay/', views.phonepe_initiate_payment, name='phonepe_initiate_payment'),
    path('phonepe/webhook/', views.phonepe_webhook, name='phonepe_webhook'),
    path('phonepe/redirect/', views.phonepe_redirect_callback, name='phonepe_redirect_callback'),
    path('payment-status/<str:order_id>/', views.payment_status_api, name='payment_status_api'),
    path('submit-payment-request/', views.submit_payment_request, name='submit_payment_request'),
    path('plan-details/', views.plan_details, name='plan_details'),
    path('download-invoice/<int:invoice_id>/', views.download_invoice, name='download_invoice'),
    path('api/password-reset/request-otp/', views.api_request_password_reset_otp, name='api_request_password_reset_otp'),
    path('api/password-reset/verify-otp/', views.api_verify_password_reset_otp, name='api_verify_password_reset_otp'),
    path('api/password-reset/confirm/', views.api_confirm_password_reset, name='api_confirm_password_reset'),
]
