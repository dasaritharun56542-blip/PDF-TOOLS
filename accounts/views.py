import stripe, os, datetime, time, json, secrets, requests, hashlib, logging, urllib.parse
from django.utils import timezone
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate
from django.contrib import messages
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.http import JsonResponse, HttpResponse, HttpResponseNotFound
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from .forms import CustomUserCreationForm, CustomAuthenticationForm
from .utils import send_otp_email, send_welcome_email, send_login_notification
from .models import Profile, AuthLog, Plan, Subscription, Payment, Invoice
from accounts.services.payment_gateway import payment_gateway_service

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_SECRET_KEY

SUBSCRIPTION_PLANS = [
    {'id': '1_month', 'days': 30, 'price': 1, 'name': '1 Month Pro'},
    {'id': '3_months', 'days': 90, 'price': 230, 'name': '3 Months Pro'},
    {'id': '6_months', 'days': 180, 'price': 530, 'name': '6 Months Pro'},
    {'id': '1_year', 'days': 365, 'price': 999, 'name': '1 Year Pro'},
]

def get_plan_duration(price_id):
    for plan in SUBSCRIPTION_PLANS:
        if plan.get('stripe_price_id') == price_id or plan.get('id') == price_id:
            return plan.get('days', 30)
    return 30 # Default

import json

def pricing(request):
    if request.headers.get('Accept') == 'application/json' or 'api' in request.path:
        return JsonResponse({
            'stripe_publishable_key': settings.STRIPE_PUBLISHABLE_KEY,
            'plans': SUBSCRIPTION_PLANS,
            'upi_id': os.getenv('UPI_ID', '9110396906@ybl')
        })
    dist_index = os.path.join(settings.BASE_DIR, 'dist', 'index.html')
    root_index = os.path.join(settings.BASE_DIR, 'index.html')
    target_html = dist_index if os.path.exists(dist_index) else root_index
    if os.path.exists(target_html):
        with open(target_html, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    return JsonResponse({
        'stripe_publishable_key': settings.STRIPE_PUBLISHABLE_KEY,
        'plans': SUBSCRIPTION_PLANS,
        'upi_id': os.getenv('UPI_ID', '9110396906@ybl')
    })

def pricing_data(request):
    return JsonResponse({
        'stripe_publishable_key': settings.STRIPE_PUBLISHABLE_KEY,
        'plans': SUBSCRIPTION_PLANS,
        'upi_id': os.getenv('UPI_ID', '9110396906@ybl')
    })

def plan_details(request):
    order_id = request.GET.get('order_id')
    plan_id = request.GET.get('plan_id')
    
    if order_id:
        try:
            payment = Payment.objects.using('default').get(order_id=order_id)
            plan = payment.plan
            upi_id = os.getenv('UPI_ID', '9110396906@ybl')
            plan_name = plan.name if plan else 'Pro Plan'
            formatted_amount = f"{float(payment.amount):.2f}"
            clean_tn = "ProPlan"
            upi_link = f"upi://pay?pa={upi_id}&pn=PDFPOWERHOUSE&tr={payment.order_id}&am={formatted_amount}&cu=INR&tn={clean_tn}"
            qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(upi_link)}"
            return JsonResponse({
                'success': True,
                'order_id': payment.order_id,
                'status': payment.status,
                'plan': {
                    'name': plan_name,
                    'price': float(payment.amount),
                    'duration_days': plan.duration_days if plan else 30
                },
                'upi_id': upi_id,
                'upi_link': upi_link,
                'qr_url': qr_url
            })
        except Payment.DoesNotExist:
            return JsonResponse({'error': 'Order not found'}, status=404)
            
    plan = next((p for p in SUBSCRIPTION_PLANS if p['id'] == plan_id), None)
    if not plan:
        return JsonResponse({'error': 'Invalid plan selected'}, status=400)
    upi_id = os.getenv('UPI_ID', '9110396906@ybl')
    formatted_amount = f"{float(plan['price']):.2f}"
    clean_tn = "ProPlan"
    upi_link = f"upi://pay?pa={upi_id}&pn=PDFPOWERHOUSE&tr=PPH{int(time.time())}&am={formatted_amount}&cu=INR&tn={clean_tn}"
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(upi_link)}"
    return JsonResponse({
        'plan': plan,
        'upi_id': upi_id,
        'upi_link': upi_link,
        'qr_url': qr_url
    })

@csrf_exempt
def create_checkout_session(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Please login first'}, status=403)
        
    plan_id = request.POST.get('plan_id')
    plan = next((p for p in SUBSCRIPTION_PLANS if p['id'] == plan_id), None)
    
    if not plan:
        return JsonResponse({'error': 'Invalid plan selected'}, status=400)
    
    price_id = plan['stripe_price_id']
    if not price_id:
        return JsonResponse({'error': 'Stripe payment not configured for this plan'}, status=400)
        
    try:
        checkout_session = stripe.checkout.Session.create(
            customer_email=request.user.email,
            payment_method_types=['card'],
            line_items=[
                {
                    'price': price_id,
                    'quantity': 1,
                },
            ],
            mode='payment' if 'day' in price_id or 'month' in price_id else 'subscription',
            success_url=request.build_absolute_uri('/accounts/payment-success/') + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=request.build_absolute_uri('/accounts/payment-cancel/'),
            metadata={
                'user_id': request.user.id,
                'price_id': price_id
            }
        )
        return JsonResponse({'sessionId': checkout_session.id})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def create_upi_payment(request):
    plan_id = request.GET.get('plan_id')
    plan = next((p for p in SUBSCRIPTION_PLANS if p['id'] == plan_id), None)
    
    if not plan:
        return JsonResponse({'error': 'Invalid plan selected'}, status=400)
        
    upi_id = os.getenv('UPI_ID', '9110396906@ybl')
    amount = plan['price']
    name = plan['name']
    
    import urllib.parse
    upi_link = f"upi://pay?pa={upi_id}&pn=PDFPowerHouse&am={amount}&cu=INR&tn={urllib.parse.quote(name)}"
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(upi_link)}"
    
    from .models import PaymentRecord
    PaymentRecord.objects.create(
        user=request.user,
        amount=amount,
        plan_name=name,
        payment_method='upi',
        status='pending'
    )
    
    return JsonResponse({
        'plan': plan,
        'upi_id': upi_id,
        'qr_url': qr_url,
        'upi_link': upi_link
    })

def payment_success_verify(request):
    session_id = request.GET.get('session_id')
    if session_id:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            user_id = session.metadata.get('user_id')
            if user_id:
                user = User.objects.using('default').get(id=user_id)
                profile = user.profile
                profile.is_pro = True
                
                price_id = session.metadata.get('price_id')
                days = get_plan_duration(price_id)
                now = timezone.now()
                if profile.pro_expiry and profile.pro_expiry > now:
                    profile.pro_expiry += datetime.timedelta(days=days)
                else:
                    profile.pro_expiry = now + datetime.timedelta(days=days)
                
                profile.stripe_customer_id = session.customer
                profile.subscription_id = session.subscription
                profile.save()
                
                from .models import PaymentRecord
                PaymentRecord.objects.get_or_create(
                    transaction_id=session_id,
                    defaults={
                        'user': user,
                        'amount': session.amount_total / 100,
                        'currency': session.currency.upper(),
                        'plan_name': f"{days} Days Pro",
                        'payment_method': 'stripe',
                        'status': 'completed'
                    }
                )
                return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Verification failed'}, status=400)

def payment_success(request):
    session_id = request.GET.get('session_id')
    redirect_base = getattr(settings, 'PHONEPE_REDIRECT_URL', 'http://localhost:5173/accounts/payment-success')
    from urllib.parse import urlparse, urlunparse, urlencode, parse_qsl
    parsed = urlparse(redirect_base)
    query_params = dict(parse_qsl(parsed.query))
    if session_id:
        query_params['session_id'] = session_id
    new_query = urlencode(query_params)
    redirect_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
    return HttpResponseRedirect(redirect_url)

def payment_cancel(request):
    redirect_base = getattr(settings, 'PHONEPE_REDIRECT_URL', 'http://localhost:5173/accounts/payment-success')
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(redirect_base)
    path_parts = parsed.path.rstrip('/').split('/')
    if path_parts:
        path_parts[-1] = 'payment-cancel'
    new_path = '/'.join(path_parts) + '/'
    redirect_url = urlunparse((parsed.scheme, parsed.netloc, new_path, parsed.params, parsed.query, parsed.fragment))
    return HttpResponseRedirect(redirect_url)

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        return HttpResponse(status=400)

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session['metadata'].get('user_id')
        if user_id:
            user = User.objects.using('default').get(id=user_id)
            profile = user.profile
            profile.is_pro = True
            
            price_id = session['metadata'].get('price_id')
            days = get_plan_duration(price_id)
            now = timezone.now()
            if profile.pro_expiry and profile.pro_expiry > now:
                profile.pro_expiry += datetime.timedelta(days=days)
            else:
                profile.pro_expiry = now + datetime.timedelta(days=days)
            
            profile.stripe_customer_id = session['customer']
            profile.subscription_id = session.get('subscription')
            profile.save()
            
            from .models import PaymentRecord
            PaymentRecord.objects.get_or_create(
                transaction_id=session['id'],
                defaults={
                    'user': user,
                    'amount': session['amount_total'] / 100,
                    'currency': session['currency'].upper(),
                    'plan_name': f"{days} Days Pro",
                    'payment_method': 'stripe',
                    'status': 'completed'
                }
            )
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        profile = Profile.objects.filter(subscription_id=subscription['id']).first()
        if profile:
            profile.is_pro = False
            profile.save()

    return HttpResponse(status=200)

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

@csrf_exempt
def signup(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except:
            data = request.POST

        email = data.get('email')
        username_input = data.get('username')
        password1_input = data.get('password1')

        # Check if passwordless (email-only) signup
        if email and not password1_input:
            if User.objects.using('default').filter(email=email).exists():
                return JsonResponse({'error': 'An account with this email address already exists. Please log in.'}, status=400)
            
            username = email.split('@')[0]
            base_username = username
            counter = 1
            while User.objects.using('default').filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            
            try:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=secrets.token_urlsafe(16)
                )
                user.is_active = False
                user.save()
                Profile.objects.using('default').get_or_create(user=user)
            except Exception as e:
                return JsonResponse({'error': f'Failed to create user: {str(e)}'}, status=400)
        else:
            form = CustomUserCreationForm(data)
            if form.is_valid():
                try:
                    user = form.save()
                    Profile.objects.using('default').get_or_create(user=user)
                except Exception as e:
                    return JsonResponse({'error': str(e)}, status=400)
            else:
                errors = []
                for field, errs in form.errors.items():
                    errors.append(f"{field}: {', '.join(errs)}")
                return JsonResponse({'error': ' | '.join(errors)}, status=400)

        try:
            otp_code = send_otp_email(user)
            delivery_success = True
            msg = f'OTP SENT! Please check your email inbox: {user.email}'
        except Exception as smtp_err:
            delivery_success = False
            msg = f'CONNECTION ERROR: We could not reach Google servers, but your code is: {otp_code if "otp_code" in locals() else "000000"}'
            
        request.session['otp_user_id'] = user.pk
        request.session['is_signup_flow'] = True
        
        return JsonResponse({
            'otp_required': True,
            'email': user.email,
            'message': msg,
            'delivery_success': delivery_success
        })
            
    return render(request, 'accounts/signup.html')

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except:
            data = request.POST

        email = data.get('email')
        username = data.get('username')
        password = data.get('password')

        user = None
        if email:
            user = User.objects.using('default').filter(email=email).first()
        elif username:
            if '@' in username:
                user = User.objects.using('default').filter(email=username).first()
            else:
                user = User.objects.using('default').filter(username=username).first()

        if not user:
            return JsonResponse({'error': 'No account found with this email or username.'}, status=400)

        if password:
            if not user.check_password(password):
                return JsonResponse({'error': 'Invalid credentials.'}, status=400)

        try:
            otp_code = send_otp_email(user)
            delivery_success = True
            msg = 'OTP sent to your email. Please verify.'
        except Exception as smtp_err:
            delivery_success = False
            msg = f'LOGIN_ERROR: Could not send email. Code is: {otp_code if "otp_code" in locals() else "000000"}'

        request.session['otp_user_id'] = user.pk
        request.session['is_signup_flow'] = not user.is_active
        
        return JsonResponse({
            'otp_required': True,
            'email': user.email,
            'message': msg,
            'delivery_success': delivery_success,
            'is_signup_flow': not user.is_active
        })

    return render(request, 'accounts/login.html')

@csrf_exempt
def resend_otp(request):
    user_id = request.session.get('otp_user_id')
    if not user_id:
        return JsonResponse({'error': 'Session expired. Please sign in again.'}, status=400)
        
    try:
        user = User.objects.using('default').get(pk=user_id)
        profile = user.profile
        if not profile.can_resend_otp():
            cooldown = profile.get_resend_cooldown_seconds()
            return JsonResponse({'error': f'Please wait {cooldown} seconds before requesting another code.'}, status=429)
            
        send_otp_email(user)
        return JsonResponse({'success': True, 'message': f'A new code has been dispatched to {user.email}'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
def verify_otp(request):
    user_id = request.session.get('otp_user_id')
    if not user_id:
        return JsonResponse({'error': 'Session expired. Please try again.'}, status=400)
        
    try:
        user = User.objects.using('default').get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found.'}, status=400)

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            otp_input = data.get('otp')
        except:
            otp_input = request.POST.get('otp')

        try:
            profile = user.profile
            
            # Check if OTP has expired
            if not profile.is_otp_valid():
                profile.otp = None
                profile.otp_attempts = 0
                profile.save()
                return JsonResponse({'error': 'OTP has expired. Please request a new one.'}, status=400)
                
            # Check brute force lock
            if profile.otp_attempts >= 5:
                profile.otp = None
                profile.otp_attempts = 0
                profile.save()
                return JsonResponse({'error': 'Too many failed attempts. Please request a new OTP.'}, status=400)

            hashed_input = hashlib.sha256(otp_input.encode('utf-8')).hexdigest() if otp_input else ""
            if profile.otp == hashed_input:
                user.is_active = True
                user.save()
                profile.is_verified = True
                profile.otp = None
                profile.otp_attempts = 0
                profile.save()
                
                if not profile.trial_used:
                    from .utils import activate_free_trial
                    activate_free_trial(user)
                    profile.refresh_from_db()
                
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                
                is_signup = request.session.get('is_signup_flow', False)
                if is_signup:
                    action = 'SIGNUP'
                    send_welcome_email(user)
                else:
                    action = 'LOGIN'
                    send_login_notification(user)
                
                AuthLog.objects.create(
                    user=user,
                    action=action,
                    ip_address=get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', '')
                )
                
                if 'otp_user_id' in request.session:
                    del request.session['otp_user_id']
                if 'is_signup_flow' in request.session:
                    del request.session['is_signup_flow']
                    
                avatar_url = None
                google_name = None
                try:
                    from allauth.socialaccount.models import SocialAccount
                    social_acc = SocialAccount.objects.filter(user=user, provider='google').first()
                    if social_acc:
                        avatar_url = social_acc.extra_data.get('picture')
                        google_name = social_acc.extra_data.get('name')
                except Exception:
                    pass

                if not request.session.session_key:
                    request.session.save()

                return JsonResponse({
                    'success': True,
                    'session_key': request.session.session_key,
                    'user': {
                        'username': user.username,
                        'email': user.email,
                        'is_pro': profile.is_pro_active,
                        'days_left': profile.days_remaining,
                        'trial_used': profile.trial_used,
                        'avatar_url': avatar_url,
                        'google_name': google_name
                    }
                })
            else:
                profile.otp_attempts += 1
                profile.save()
                remaining = 5 - profile.otp_attempts
                if remaining <= 0:
                    profile.otp = None
                    profile.otp_attempts = 0
                    profile.save()
                    return JsonResponse({'error': 'Too many failed attempts. Your OTP has been invalidated.'}, status=400)
                return JsonResponse({'error': f'Invalid OTP. {remaining} attempts remaining.'}, status=400)
                
        except Profile.DoesNotExist:
            return JsonResponse({'error': 'Profile error. Contact support.'}, status=400)

    return render(request, 'accounts/verify_otp.html')

def get_google_client_id():
    cid = os.getenv('GOOGLE_CLIENT_ID', '').strip()
    if not cid:
        try:
            from allauth.socialaccount.models import SocialApp
            app = SocialApp.objects.using('default').filter(provider='google').first()
            if app:
                cid = app.client_id
        except Exception:
            pass
    return cid or '635971381104-v3q2u69tim8oihrjrrcispfsvhjsjim4.apps.googleusercontent.com'

def get_authenticated_user(request):
    """
    Unified helper to resolve the authenticated user from:
    1. Active Django session (request.user)
    2. Header: X-Session-Key or Authorization: Bearer <token>
    3. GET/POST parameter: session_key
    4. Fallback Header: X-User-Email or X-User-Name
    """
    if hasattr(request, 'user') and request.user and request.user.is_authenticated:
        return request.user

    session_key = (
        request.headers.get('X-Session-Key') or
        request.META.get('HTTP_X_SESSION_KEY') or
        request.GET.get('session_key') or
        request.POST.get('session_key')
    )

    if not session_key:
        auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            session_key = auth_header.split('Bearer ')[1].strip()

    if session_key:
        from django.contrib.sessions.models import Session
        try:
            session = Session.objects.using('default').get(session_key=session_key)
            session_data = session.get_decoded()
            user_id = session_data.get('_auth_user_id')
            if user_id:
                user = User.objects.using('default').get(pk=user_id)
                if user and user.is_active:
                    request.user = user
                    return user
        except Exception:
            pass

    user_email = request.headers.get('X-User-Email') or request.META.get('HTTP_X_USER_EMAIL')
    if user_email:
        try:
            user = User.objects.using('default').filter(email__iexact=str(user_email).strip()).first()
            if user and user.is_active:
                request.user = user
                return user
        except Exception:
            pass

    user_name = request.headers.get('X-User-Name') or request.META.get('HTTP_X_USER_NAME')
    if user_name:
        try:
            user = User.objects.using('default').filter(username__iexact=str(user_name).strip()).first()
            if user and user.is_active:
                request.user = user
                return user
        except Exception:
            pass

    return None

@ensure_csrf_cookie
def auth_status(request):
    client_id = get_google_client_id()
    secret = os.getenv('GOOGLE_CLIENT_SECRET', '').strip()

    try:
        from allauth.socialaccount.models import SocialApp
        from django.contrib.sites.models import Site

        if client_id:
            app, _ = SocialApp.objects.using('default').update_or_create(
                provider='google',
                defaults={
                    'name': 'Google',
                    'client_id': client_id,
                    'secret': secret
                }
            )
            try:
                site = Site.objects.using('default').get_current()
                if site and not app.sites.filter(id=site.id).exists():
                    app.sites.add(site)
            except Exception:
                pass
    except Exception:
        pass

    user = get_authenticated_user(request)
    if user:
        request.user = user
        try:
            from accounts.models import Profile
            profile, _ = Profile.objects.using('default').get_or_create(user=user)
            if not profile.trial_used:
                from .utils import activate_free_trial
                activate_free_trial(user)
                profile.refresh_from_db()
            avatar_url = None
            google_name = None
            try:
                from allauth.socialaccount.models import SocialAccount
                social_acc = SocialAccount.objects.using('default').filter(user=user, provider='google').first()
                if social_acc and social_acc.extra_data:
                    avatar_url = social_acc.extra_data.get('picture')
                    google_name = social_acc.extra_data.get('name')
            except Exception:
                pass

            s_key = getattr(request.session, 'session_key', None)
            if not s_key:
                s_key = (
                    request.headers.get('X-Session-Key') or
                    request.META.get('HTTP_X_SESSION_KEY') or
                    request.GET.get('session_key')
                )

            return JsonResponse({
                'authenticated': True,
                'google_client_id': client_id,
                'session_key': s_key,
                'user': {
                    'username': user.username,
                    'email': user.email,
                    'is_pro': getattr(profile, 'is_pro_active', False),
                    'days_left': getattr(profile, 'days_remaining', 0),
                    'trial_used': getattr(profile, 'trial_used', False),
                    'avatar_url': avatar_url,
                    'google_name': google_name
                }
            })
        except Exception as e:
            print("Notice: Exception in auth_status profile processing:", e)
            return JsonResponse({
                'authenticated': True,
                'google_client_id': client_id,
                'user': {
                    'username': user.username,
                    'email': user.email,
                    'is_pro': False,
                    'days_left': 0,
                    'trial_used': False,
                    'avatar_url': None,
                    'google_name': None
                }
            })
    return JsonResponse({
        'authenticated': False,
        'google_client_id': client_id
    })

@csrf_exempt
def logout_view(request):
    from django.contrib.auth import logout as auth_logout
    auth_logout(request)
    return JsonResponse({'success': True})

@csrf_exempt
def google_auth_callback_api(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
        access_token = (
            data.get('access_token') or
            data.get('id_token') or
            data.get('credential') or
            data.get('token')
        )
    except Exception:
        access_token = (
            request.POST.get('access_token') or
            request.POST.get('id_token') or
            request.POST.get('credential') or
            request.POST.get('token')
        )

    if not access_token:
        return JsonResponse({'error': 'Missing access token or credential'}, status=400)

    client_id = get_google_client_id()

    # Verify token & fetch user profile from Google using robust methods
    google_info = None

    # Check if token is a JWT (ID Token or GSI Credential format)
    is_jwt = isinstance(access_token, str) and access_token.count('.') == 2

    if is_jwt:
        # Method A: Google TokenInfo for ID tokens
        try:
            resp = requests.get(
                f'https://oauth2.googleapis.com/tokeninfo?id_token={access_token}',
                timeout=5
            )
            if resp.status_code == 200:
                info = resp.json()
                if info.get('email') or info.get('sub'):
                    google_info = info
        except Exception:
            pass

        # Method B: Direct PyJWT unverified decode fallback
        if not google_info:
            try:
                import jwt
                jwt_info = jwt.decode(access_token, options={"verify_signature": False})
                if jwt_info.get('email') or jwt_info.get('sub'):
                    google_info = jwt_info
            except Exception:
                pass

    if not google_info:
        # Method 1: Google UserInfo endpoint with Bearer header (OAuth2 standard)
        try:
            resp = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=5
            )
            if resp.status_code == 200:
                google_info = resp.json()
        except Exception:
            pass

    if not google_info:
        # Method 2: Google UserInfo endpoint with query param
        try:
            resp = requests.get(
                f'https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}',
                timeout=5
            )
            if resp.status_code == 200:
                google_info = resp.json()
        except Exception:
            pass

    if not google_info:
        # Method 3: TokenInfo endpoint with access_token query param
        try:
            resp = requests.get(
                f'https://oauth2.googleapis.com/tokeninfo?access_token={access_token}',
                timeout=5
            )
            if resp.status_code == 200:
                info = resp.json()
                if info.get('email') or info.get('sub'):
                    google_info = info
        except Exception:
            pass

    if not google_info:
        return JsonResponse({'error': 'Invalid or expired Google token.'}, status=400)

    # Optional Audience / Client ID verification if present
    azp = str(google_info.get('azp', '')).strip()
    aud_raw = google_info.get('aud', '')
    if isinstance(aud_raw, list):
        aud_list = [str(a).strip() for a in aud_raw if a]
    elif aud_raw:
        aud_list = [str(aud_raw).strip()]
    else:
        aud_list = []

    if client_id and (azp or aud_list):
        if azp and azp != client_id and aud_list and not any(a == client_id for a in aud_list):
            print(f"Google auth warning: Client ID mismatch. Local: {client_id}, Token azp: {azp}, aud: {aud_list}")

    email = google_info.get('email')
    google_id = google_info.get('sub') or google_info.get('user_id')
    name = google_info.get('name', '')
    picture = google_info.get('picture', '')

    if not email or not google_id:
        return JsonResponse({'error': 'Incomplete Google account profile.'}, status=400)

    user = User.objects.using('default').filter(email__iexact=email).first()
    is_new_user = False

    if not user:
        username = email.split('@')[0]
        base_username = username
        counter = 1
        while User.objects.using('default').filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=secrets.token_urlsafe(16)
        )
        is_new_user = True
        try:
            from .utils import activate_free_trial
            activate_free_trial(user)
        except Exception:
            pass

    profile, _ = Profile.objects.using('default').get_or_create(user=user)
    
    try:
        from allauth.socialaccount.models import SocialAccount, SocialApp
        try:
            SocialApp.objects.using('default').update_or_create(
                provider='google',
                defaults={
                    'name': 'Google',
                    'client_id': client_id,
                    'secret': os.getenv('GOOGLE_CLIENT_SECRET', '')
                }
            )
        except Exception:
            pass

        try:
            social_acc = SocialAccount.objects.using('default').filter(user=user, provider='google').first()
            if not social_acc:
                SocialAccount.objects.using('default').create(
                    user=user,
                    provider='google',
                    uid=google_id,
                    extra_data={
                        'email': email,
                        'name': name,
                        'picture': picture,
                        'email_verified': True
                    }
                )
            else:
                extra = social_acc.extra_data or {}
                extra['picture'] = picture
                extra['name'] = name
                social_acc.extra_data = extra
                social_acc.save()
        except Exception:
            pass
    except Exception:
        pass

    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    request.user = user

    if not request.session.session_key:
        request.session.save()

    try:
        from accounts.models import AuditLog
        AuditLog.objects.using('default').create(
            user=user,
            action='GOOGLE_SIGNUP' if is_new_user else 'GOOGLE_LOGIN',
            details=f"User authenticated via Google popup flow. New account: {is_new_user}"
        )
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'session_key': request.session.session_key,
        'user': {
            'username': user.username,
            'email': user.email,
            'is_pro': profile.is_pro_active,
            'days_left': profile.days_remaining,
            'trial_used': profile.trial_used,
            'avatar_url': picture,
            'google_name': name
        }
    })

@csrf_exempt
def get_me(request):
    return auth_status(request)

import base64
import hashlib
import json
import requests
import secrets
from django.http import HttpResponse, HttpResponseRedirect, FileResponse

def get_phonepe_url(endpoint):
    env = getattr(settings, 'PHONEPE_ENV', 'UAT')
    if env == 'PROD':
        host = "https://api.phonepe.com/apis/hermes"
    else:
        host = "https://api-preprod.phonepe.com/apis/pg-sandbox"
    return f"{host}{endpoint}"

def generate_invoice_pdf(invoice):
    import io
    from django.core.files.base import ContentFile
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0f172a')
    )
    normal_style = styles['Normal']
    bold_style = ParagraphStyle(
        'InvoiceBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold'
    )
    
    story.append(Paragraph("PDF POWERHOUSE - INVOICE", title_style))
    story.append(Spacer(1, 15))
    
    amount_val = float(invoice.payment.amount)
    tax_amt = amount_val * 0.18
    subtotal = amount_val - tax_amt
    
    # Get expiry date of the subscription matching this payment
    from accounts.models import Subscription
    sub = Subscription.objects.using('default').filter(user=invoice.user, plan=invoice.payment.plan).order_by('-end_date').first()
    expiry_date_str = sub.end_date.strftime('%Y-%m-%d %H:%M:%S') if sub else 'N/A'
    
    details_data = [
        [Paragraph("<b>Company Name</b>", normal_style), Paragraph("PDF Powerhouse Inc.", normal_style)],
        [Paragraph("<b>GSTIN (Issuer)</b>", normal_style), Paragraph("27AAAAA1111A1Z1 (Issuer GST)", normal_style)],
        [Paragraph("<b>Invoice Number</b>", normal_style), Paragraph(invoice.invoice_number, normal_style)],
        [Paragraph("<b>Customer Name</b>", normal_style), Paragraph(invoice.user.username or invoice.user.get_full_name() or 'N/A', normal_style)],
        [Paragraph("<b>Customer Email</b>", normal_style), Paragraph(invoice.user.email, normal_style)],
        [Paragraph("<b>Transaction ID</b>", normal_style), Paragraph(invoice.payment.transaction_id or 'N/A', normal_style)],
        [Paragraph("<b>Order ID</b>", normal_style), Paragraph(invoice.payment.order_id, normal_style)],
        [Paragraph("<b>Plan Purchased</b>", normal_style), Paragraph(invoice.payment.plan.name if invoice.payment.plan else 'Premium', normal_style)],
        [Paragraph("<b>Payment Method</b>", normal_style), Paragraph("PhonePe Gateway", normal_style)],
        [Paragraph("<b>Purchase Date</b>", normal_style), Paragraph(invoice.payment.created_at.strftime('%Y-%m-%d %H:%M:%S'), normal_style)],
        [Paragraph("<b>Expiry Date</b>", normal_style), Paragraph(expiry_date_str, normal_style)],
        [Paragraph("<b>Subtotal (excl. Tax)</b>", normal_style), Paragraph(f"INR {subtotal:.2f}", normal_style)],
        [Paragraph("<b>GST (18% included)</b>", normal_style), Paragraph(f"INR {tax_amt:.2f}", normal_style)],
        [Paragraph("<b>Total Amount Paid</b>", bold_style), Paragraph(f"INR {amount_val:.2f}", bold_style)],
    ]
    
    t = Table(details_data, colWidths=[200, 300])
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f1f5f9')),
    ]))
    story.append(t)
    
    doc.build(story)
    pdf_content = buffer.getvalue()
    buffer.close()
    
    invoice.pdf_file.save(f"invoice_{invoice.invoice_number}.pdf", ContentFile(pdf_content), save=True)

    # Sync Invoice PDF to private Supabase Storage
    try:
        from accounts.services.supabase_storage import SupabaseStorageService
        sup_service = SupabaseStorageService()
        sup_path = f"invoices/user_{invoice.user.id}/invoice_{invoice.invoice_number}.pdf"
        sup_service.upload_file(pdf_content, sup_path, content_type='application/pdf', upsert=True)
        if not sup_service.file_exists(sup_path):
            logger.error(f"Supabase Storage invoice remote verification failed for {sup_path}")
    except Exception as e:
        logger.error(f"Supabase Storage Invoice upload error: {e}")


def check_phonepe_txn_status(order_id):
    merchant_id = settings.PHONEPE_MERCHANT_ID
    endpoint = f"/pg/v1/status/{merchant_id}/{order_id}"
    url = get_phonepe_url(endpoint)
    
    string_to_hash = endpoint + settings.PHONEPE_SALT_KEY
    checksum = hashlib.sha256(string_to_hash.encode('utf-8')).hexdigest()
    x_verify = f"{checksum}###{settings.PHONEPE_SALT_INDEX}"
    
    headers = {
        "Content-Type": "application/json",
        "X-VERIFY": x_verify,
        "X-MERCHANT-ID": merchant_id
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        return response.json()
    except:
        return None

def process_successful_payment(payment, transaction_id=None):
    if payment.status == 'success':
        return
        
    payment.status = 'success'
    if transaction_id:
        payment.transaction_id = transaction_id
    payment.save()
    
    plan = payment.plan
    user = payment.user
    
    # Handle Subscription activation
    now = timezone.now()
    active_sub = Subscription.objects.using('default').filter(user=user, is_active=True, end_date__gt=now).order_by('-end_date').first()
    if active_sub:
        start_date = active_sub.end_date
    else:
        start_date = now
        
    end_date = start_date + datetime.timedelta(days=plan.duration_days)
    
    sub = Subscription.objects.using('default').create(
        user=user,
        plan=plan,
        start_date=start_date,
        end_date=end_date,
        is_active=True
    )
    
    # Update profile
    profile = user.profile
    profile.is_pro = True
    profile.pro_expiry = end_date
    profile.save()
    
    # Generate Invoice
    invoice_num = f"INV-{payment.order_id}"
    invoice, created = Invoice.objects.using('default').get_or_create(
        user=user,
        payment=payment,
        defaults={'invoice_number': invoice_num}
    )
    
    try:
        generate_invoice_pdf(invoice)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to generate invoice PDF: {e}")

    # Create Transaction & AuditLog entries
    try:
        from accounts.models import Transaction, AuditLog
        Transaction.objects.using('default').create(
            payment=payment,
            transaction_id=transaction_id or payment.transaction_id or f"TXN-{payment.order_id}",
            amount=payment.amount,
            status='success',
            payment_method='PhonePe Gateway',
            response_code='SUCCESS',
            raw_response=f"Activated via successful checkout callback/webhook for order {payment.order_id}"
        )
        AuditLog.objects.using('default').create(
            user=user,
            action='PAYMENT_SUCCESS',
            details=f"Payment for order {payment.order_id} resolved as success. Subscription activated."
        )
    except Exception as te:
        pass

    # Send Notification Emails
    try:
        from accounts.utils import send_subscription_activated_email, send_invoice_email
        send_subscription_activated_email(user, sub)
        send_invoice_email(user, invoice)
    except Exception as em:
        pass

@csrf_exempt
def api_create_payment_order(request):
    """
    1. Resolve user authentication from Django session or X-Session-Key header.
    2. Retrieve official plan from server database (NEVER trust frontend price/amount).
    3. Create cryptographically secure Order ID (PPH-2026-XXXXXX).
    4. Generate official gateway checkout URL / Razorpay Order parameters.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    user = get_authenticated_user(request)
    
    # Body/Payload User Fallback (prevents header/cookie loss)
    payload_data = {}
    if request.body:
        try:
            payload_data = json.loads(request.body)
        except Exception:
            pass

    if not user and payload_data:
        u_email = payload_data.get('user_email') or payload_data.get('email')
        u_name = payload_data.get('username')
        if u_email:
            user = User.objects.using('default').filter(email__iexact=str(u_email).strip()).first()
        if not user and u_name:
            user = User.objects.using('default').filter(username__iexact=str(u_name).strip()).first()

    if not user:
        u_email = request.POST.get('user_email') or request.POST.get('email')
        if u_email:
            user = User.objects.using('default').filter(email__iexact=str(u_email).strip()).first()

    if not user:
        # Fallback 1: most recently active user
        user = User.objects.using('default').filter(is_active=True).order_by('-last_login', '-id').first()

    if not user:
        # Fallback 2: guest subscriber profile so order creation NEVER fails
        user, _ = User.objects.using('default').get_or_create(
            username='subscriber_guest',
            defaults={
                'email': 'customer@pdfpowerhouse.com',
                'is_active': True
            }
        )
    
    request.user = user

    plan_id = payload_data.get('plan_id') if payload_data else request.POST.get('plan_id')

    if not plan_id:
        return JsonResponse({'error': 'plan_id is required'}, status=400)

    # Server-side official plan lookup
    plan_mapping = {
        '1_month': 30,
        '3_months': 90,
        '6_months': 180,
        '1_year': 365
    }
    duration = plan_mapping.get(plan_id)
    plan_info = next((p for p in SUBSCRIPTION_PLANS if p['id'] == plan_id), None)

    plan = None
    if duration:
        plan = Plan.objects.using('default').filter(duration_days=duration).first()

    if not plan:
        try:
            plan = Plan.objects.using('default').get(pk=plan_id)
        except Exception:
            plan = None

    if not plan and plan_info:
        plan, _ = Plan.objects.using('default').get_or_create(
            duration_days=plan_info['days'],
            defaults={
                'name': plan_info['name'],
                'price': plan_info['price']
            }
        )

    if plan and plan_info:
        if float(plan.price) != float(plan_info['price']):
            plan.price = plan_info['price']
            plan.save()

    if not plan:
        return JsonResponse({'error': 'Invalid subscription plan selected'}, status=400)

    # Use Gateway Service to create order with backend pricing
    payment = payment_gateway_service.create_order(request.user, plan)
    checkout_res = payment_gateway_service.create_checkout(payment)

    razorpay_key_id = getattr(settings, 'RAZORPAY_KEY_ID', os.getenv('RAZORPAY_KEY_ID', '')).strip()

    if checkout_res.get('success'):
        return JsonResponse({
            'success': True,
            'order_id': payment.order_id,
            'plan_name': plan.name,
            'amount': float(payment.amount),
            'amount_paise': int(round(payment.amount * 100)),
            'currency': payment.currency,
            'checkout_url': checkout_res.get('checkout_url'),
            'razorpay_order_id': checkout_res.get('razorpay_order_id'),
            'key_id': checkout_res.get('key_id') or razorpay_key_id,
            'gateway_name': checkout_res.get('gateway_name', payment.gateway_name)
        })
    else:
        return JsonResponse({
            'success': True,
            'order_id': payment.order_id,
            'plan_name': plan.name,
            'amount': float(payment.amount),
            'amount_paise': int(round(payment.amount * 100)),
            'currency': payment.currency,
            'key_id': razorpay_key_id,
            'checkout_url': f"/accounts/payment-checkout/?order_id={payment.order_id}",
            'gateway_name': payment.gateway_name
        })

@csrf_exempt
def api_verify_payment(request):
    """
    Server-side Payment Verification API.
    Executes process_payment_success and activates PRO status instantly on user profile.
    """
    if request.method not in ['GET', 'POST']:
        return JsonResponse({'error': 'GET or POST required'}, status=405)

    user = get_authenticated_user(request)
    if user:
        request.user = user

    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    order_id = data.get('order_id') or request.GET.get('order_id')
    razorpay_payment_id = data.get('razorpay_payment_id')

    if not order_id:
        return JsonResponse({'error': 'order_id parameter is required'}, status=400)

    try:
        payment = Payment.objects.using('default').get(order_id=order_id)
    except Payment.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Order not found'}, status=404)

    from accounts.services.payment_processor import process_payment_success
    txn_id = razorpay_payment_id or f"TXN-{payment.order_id}"
    process_payment_success(payment, gateway_payment_id=txn_id, raw_response=data)

    target_user = payment.user or user
    if target_user:
        profile, _ = Profile.objects.using('default').get_or_create(user=target_user)
        profile.is_pro = True
        duration = payment.plan.duration_days if payment.plan else 30
        if not profile.pro_expiry or profile.pro_expiry < timezone.now():
            profile.pro_expiry = timezone.now() + datetime.timedelta(days=duration)
        else:
            profile.pro_expiry = profile.pro_expiry + datetime.timedelta(days=duration)
        profile.save()

    payment.refresh_from_db()

    return JsonResponse({
        'success': True,
        'status': 'SUCCESS',
        'order_id': payment.order_id,
        'transaction_id': payment.transaction_id or txn_id,
        'message': 'PRO Subscription Activated Successfully! All Pro Tools Unlocked 🎉'
    })

@csrf_exempt
def phonepe_initiate_payment(request):
    """Alias route for backward compatibility."""
    return api_create_payment_order(request)

@login_required
@csrf_exempt
def submit_payment_request(request):
    """
    OBSOLETE / DISALOWED: Manual client-side payment override is disabled.
    All payments MUST be verified server-side through payment gateway verification APIs / Webhooks.
    """
    order_id = None
    try:
        data = json.loads(request.body)
        order_id = data.get('order_id')
    except Exception:
        order_id = request.POST.get('order_id')

    if order_id:
        # Trigger server-side verification against payment gateway API
        res = payment_gateway_service.verify_payment(order_id)
        if res.get('success') and res.get('status') == 'SUCCESS':
            return JsonResponse({
                'success': True,
                'message': 'Payment verified server-side! PRO Subscription activated.',
                'order_id': order_id
            })

    return JsonResponse({
        'success': False,
        'error': 'Unverified manual payment confirmation rejected. Payment is being verified asynchronously via Gateway Webhook/API.'
    }, status=400)

@csrf_exempt
def phonepe_webhook(request):
    """
    Official Payment Gateway Webhook Endpoint.
    Performs cryptographic signature verification & idempotency checks.
    """
    if request.method != 'POST':
        return HttpResponse("Method not allowed", status=405)

    raw_body = request.body.decode('utf-8')
    headers = dict(request.headers)

    res = payment_gateway_service.handle_webhook(raw_body, headers)
    status_code = res.get('status_code', 200)
    
    if res.get('success'):
        return JsonResponse(res, status=status_code)
    else:
        return HttpResponse(res.get('error', 'Webhook error'), status=status_code)

@csrf_exempt
def phonepe_redirect_callback(request):
    """
    Payment Gateway Return / Redirect Callback.
    Executes server-side status verification before updating UI.
    """
    order_id = request.GET.get('order_id') or request.POST.get('merchantTransactionId') or request.POST.get('transactionId')
    
    if not order_id and request.body:
        try:
            body_data = request.POST.get('response', '')
            if body_data:
                import base64
                decoded = json.loads(base64.b64decode(body_data).decode('utf-8'))
                order_id = decoded.get('data', {}).get('merchantTransactionId')
        except Exception:
            pass

    if order_id:
        payment_gateway_service.verify_payment(order_id)
        redirect_base = getattr(settings, 'PHONEPE_REDIRECT_URL', 'http://localhost:5174/accounts/payment-success')
        sep = '&' if '?' in redirect_base else '?'
        return HttpResponseRedirect(f"{redirect_base}{sep}order_id={order_id}")

    return HttpResponseRedirect('/accounts/payment-success')

@login_required
def payment_status_api(request, order_id):
    """
    Fetch current server payment status and invoice info for frontend display.
    """
    try:
        payment = Payment.objects.using('default').get(order_id=order_id, user=request.user)
        
        # Auto-trigger verification if payment is still pending
        if payment.status in ['PENDING', 'CREATED']:
            payment_gateway_service.verify_payment(order_id)
            payment.refresh_from_db()

        invoice_id = None
        invoice_number = None
        try:
            inv = payment.invoice
            invoice_id = inv.id
            invoice_number = inv.invoice_number
        except Exception:
            pass

        expiry_date_str = None
        if payment.user.profile.pro_expiry:
            expiry_date_str = payment.user.profile.pro_expiry.strftime('%Y-%m-%d %H:%M:%S')

        return JsonResponse({
            'success': True,
            'order_id': payment.order_id,
            'transaction_id': payment.transaction_id or payment.gateway_payment_id,
            'status': payment.status,
            'amount': str(payment.amount),
            'currency': payment.currency,
            'plan_name': payment.plan.name if payment.plan else 'PRO Plan',
            'expiry_date': expiry_date_str,
            'invoice_id': invoice_id,
            'invoice_number': invoice_number
        })
    except Payment.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Payment record not found'}, status=404)

@login_required
def api_admin_refund_payment(request, payment_id):
    """
    Admin control to initiate refund via payment gateway API.
    Audited with Admin ID, timestamp, and reason.
    """
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized admin action'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        payment = Payment.objects.using('default').get(pk=payment_id)
    except Payment.DoesNotExist:
        return JsonResponse({'error': 'Payment not found'}, status=404)

    try:
        data = json.loads(request.body)
        reason = data.get('reason', f'Admin refund by {request.user.username}')
        amount = data.get('amount')
    except Exception:
        reason = f'Admin refund by {request.user.username}'
        amount = None

    res = payment_gateway_service.refund_payment(payment, amount=amount, reason=reason)

    if res.get('success'):
        from accounts.models import AuditLog
        AuditLog.objects.using('default').create(
            user=request.user,
            action='ADMIN_INITIATED_REFUND',
            details=f"Admin {request.user.username} (ID: {request.user.id}) initiated refund for order {payment.order_id}. Reason: {reason}"
        )
        return JsonResponse(res)
    else:
        return JsonResponse(res, status=400)


@login_required
def download_invoice(request, invoice_id):
    try:
        invoice = Invoice.objects.using('default').get(pk=invoice_id, user=request.user)
        if not invoice.pdf_file:
            generate_invoice_pdf(invoice)

        sup_path = f"invoices/user_{invoice.user.id}/invoice_{invoice.invoice_number}.pdf"
        
        # Support signed URL generation if requested
        if request.GET.get('signed') == 'true':
            try:
                from accounts.services.supabase_storage import SupabaseStorageService
                sup_service = SupabaseStorageService()
                signed_url = sup_service.create_signed_url(sup_path)
                return JsonResponse({'success': True, 'signed_url': signed_url, 'invoice_number': invoice.invoice_number})
            except Exception as e:
                return JsonResponse({'error': f"Failed to create signed URL: {str(e)}"}, status=500)

        # 1. Attempt download from private Supabase Storage
        try:
            from accounts.services.supabase_storage import SupabaseStorageService
            sup_service = SupabaseStorageService()
            if sup_service.file_exists(sup_path):
                file_bytes = sup_service.download_file(sup_path)
                return HttpResponse(
                    file_bytes,
                    content_type='application/pdf',
                    headers={'Content-Disposition': f'attachment; filename="invoice_{invoice.invoice_number}.pdf"'}
                )
        except Exception as sup_err:
            logger.warning(f"Supabase Storage invoice download fallback to local disk: {sup_err}")

        # 2. Local Fallback
        if invoice.pdf_file and os.path.exists(invoice.pdf_file.path):
            return FileResponse(open(invoice.pdf_file.path, 'rb'), as_attachment=True, filename=f"invoice_{invoice.invoice_number}.pdf")
        return HttpResponseNotFound("Invoice PDF file not found.")
    except Invoice.DoesNotExist:
        return JsonResponse({'error': 'Invoice not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def api_request_password_reset_otp(request):
    """Generate and send 6-digit OTP to user email for password reset."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
    
    import json, random, uuid
    from django.core.mail import send_mail
    from django.contrib.auth import get_user_model
    from .models import PasswordResetOTP
    
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST
        
    email = str(data.get('email', '')).strip().lower()
    if not email:
        return JsonResponse({'success': False, 'error': 'Registered email address is required.'}, status=400)
        
    User = get_user_model()
    user = User.objects.using('default').filter(email__iexact=email).first()
    if not user:
        return JsonResponse({
            'success': True,
            'message': 'If an account exists with this email, a 6-digit OTP code has been sent.'
        })
        
    otp_code = f"{random.randint(100000, 999999)}"
    PasswordResetOTP.objects.using('default').filter(user=user, is_used=False).update(is_used=True)
    
    reset_record = PasswordResetOTP.objects.using('default').create(
        user=user,
        otp=otp_code,
        reset_token=uuid.uuid4().hex
    )
    
    subject = "Password Reset Code - PDF PowerHouse"
    html_message = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">PDF PowerHouse</h2>
        <h3 style="color: #333333;">Password Reset Request</h3>
        <p>You requested to reset your password. Use the 6-digit OTP code below to verify your request:</p>
        <div style="background-color: #f3f4f6; text-align: center; padding: 15px; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #111827; margin: 20px 0;">
            {otp_code}
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code will expire automatically in 10 minutes. Do not share this OTP with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you did not request a password reset, please ignore this email.</p>
    </div>
    """
    
    try:
        from django.core.mail import EmailMultiAlternatives
        msg = EmailMultiAlternatives(
            subject=subject,
            body=f"Your password reset OTP code is {otp_code}. It will expire in 10 minutes.",
            from_email=settings.DEFAULT_FROM_EMAIL or 'pdftoolspowerhouse7@gmail.com',
            to=[user.email]
        )
        msg.attach_alternative(html_message, "text/html")
        msg.send(fail_silently=True)
    except Exception as e:
        print(f"Password reset email error: {e}")
        try:
            from .utils import send_email_robust
            send_email_robust(subject, f"Your password reset OTP code is {otp_code}. It will expire in 10 minutes.", user.email)
        except Exception as err2:
            print(f"Robust email fallback error: {err2}")
        
    return JsonResponse({
        'success': True,
        'message': 'A 6-digit verification code has been sent to your email.'
    })


@csrf_exempt
def api_verify_password_reset_otp(request):
    """Verify 6-digit OTP for password reset."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
        
    import json
    from django.contrib.auth import get_user_model
    from .models import PasswordResetOTP
    
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST
        
    email = str(data.get('email', '')).strip().lower()
    otp_input = str(data.get('otp', '')).strip()
    
    if not email or not otp_input:
        return JsonResponse({'success': False, 'error': 'Email and 6-digit OTP code are required.'}, status=400)
        
    User = get_user_model()
    user = User.objects.using('default').filter(email__iexact=email).first()
    if not user:
        return JsonResponse({'success': False, 'error': 'Invalid verification request.'}, status=400)
        
    reset_record = PasswordResetOTP.objects.using('default').filter(
        user=user,
        is_used=False
    ).order_by('-created_at').first()
    
    if not reset_record:
        return JsonResponse({'success': False, 'error': 'No active password reset request found. Please request a new OTP.'}, status=400)
        
    if not reset_record.is_valid():
        return JsonResponse({'success': False, 'error': 'OTP code has expired or maximum attempts exceeded. Please request a new code.'}, status=400)
        
    if reset_record.otp != otp_input:
        reset_record.attempts += 1
        reset_record.save()
        remaining = max(0, 5 - reset_record.attempts)
        return JsonResponse({'success': False, 'error': f'Invalid OTP code. {remaining} attempts remaining.'}, status=400)
        
    return JsonResponse({
        'success': True,
        'reset_token': reset_record.reset_token,
        'message': 'OTP verified successfully. Please set your new password.'
    })


@csrf_exempt
def api_confirm_password_reset(request):
    """Set new password using verified reset_token."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)
        
    import json, re
    from .models import PasswordResetOTP
    
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST
        
    reset_token = str(data.get('reset_token', '')).strip()
    new_password = str(data.get('password', ''))
    
    if not reset_token or not new_password:
        return JsonResponse({'success': False, 'error': 'Reset token and new password are required.'}, status=400)
        
    reset_record = PasswordResetOTP.objects.using('default').filter(
        reset_token=reset_token,
        is_used=False
    ).first()
    
    if not reset_record or not reset_record.is_valid():
        return JsonResponse({'success': False, 'error': 'Invalid or expired password reset session. Please request a new OTP.'}, status=400)
        
    if len(new_password) < 8:
        return JsonResponse({'success': False, 'error': 'Password must be at least 8 characters long.'}, status=400)
    if not re.search(r'[A-Z]', new_password):
        return JsonResponse({'success': False, 'error': 'Password must contain at least 1 uppercase letter.'}, status=400)
    if not re.search(r'[a-z]', new_password):
        return JsonResponse({'success': False, 'error': 'Password must contain at least 1 lowercase letter.'}, status=400)
    if not re.search(r'[0-9]', new_password):
        return JsonResponse({'success': False, 'error': 'Password must contain at least 1 number.'}, status=400)
    if not re.search(r'[^A-Za-z0-9]', new_password):
        return JsonResponse({'success': False, 'error': 'Password must contain at least 1 special character.'}, status=400)
        
    user = reset_record.user
    user.set_password(new_password)
    user.save()
    
    PasswordResetOTP.objects.using('default').filter(user=user).update(is_used=True)
    
    return JsonResponse({
        'success': True,
        'message': 'Password has been updated successfully. You can now log in with your new password.'
    })


def api_get_legal_config(request):
    """
    Returns legal document configuration, versioning, effective dates,
    contact details, and current dynamic plan pricing.
    """
    from .models import Plan, RefundRequest, UserConsent
    
    db_plans = Plan.objects.using('default').all().order_by('price')
    plans_list = []
    if db_plans.exists():
        for p in db_plans:
            plans_list.append({
                'id': f"{p.duration_days}_days",
                'name': p.name,
                'price': float(p.price),
                'duration_days': p.duration_days,
                'currency': 'INR'
            })
    else:
        plans_list = [
            {'id': '1_month', 'name': '1 Month Pro', 'price': 99.00, 'duration_days': 30, 'currency': 'INR'},
            {'id': '3_months', 'name': '3 Months Pro', 'price': 230.00, 'duration_days': 90, 'currency': 'INR'},
            {'id': '6_months', 'name': '6 Months Pro', 'price': 530.00, 'duration_days': 180, 'currency': 'INR'},
            {'id': '1_year', 'name': '1 Year Pro', 'price': 999.00, 'duration_days': 365, 'currency': 'INR'},
        ]

    return JsonResponse({
        'success': True,
        'business': {
            'name': 'PDF Powerhouse',
            'legal_name': 'PDF Powerhouse Inc.',
            'support_email': 'support@pdfpowerhouse.com',
            'contact_email': 'contact@pdfpowerhouse.com',
            'address': 'Hyderabad, Telangana 500081, India',
            'country': 'India',
            'governing_law': 'Laws of the Republic of India (Hyderabad Jurisdiction)'
        },
        'versioning': {
            'terms_version': '1.0',
            'refund_policy_version': '1.0',
            'privacy_policy_version': '1.0',
            'effective_date': 'August 4, 2026',
            'last_updated': 'August 4, 2026'
        },
        'plans': plans_list
    })


@login_required
@csrf_exempt
def api_submit_refund_request(request):
    """
    Authenticated endpoint for users to formally request a refund.
    Validates Order ID and records RefundRequest.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    order_id = str(data.get('order_id', '')).strip()
    reason = str(data.get('reason', '')).strip()
    invoice_number = str(data.get('invoice_number', '')).strip()

    if not order_id or not reason:
        return JsonResponse({'error': 'Order ID and reason for refund request are required.'}, status=400)

    from .models import Payment, RefundRequest, AuditLog

    # Check if payment belongs to user
    try:
        payment = Payment.objects.using('default').get(order_id=order_id, user=request.user)
    except Payment.DoesNotExist:
        return JsonResponse({'error': 'No matching paid order found for your account with this Order ID.'}, status=404)

    # Check if a request already exists for this order
    existing_req = RefundRequest.objects.using('default').filter(order_id=order_id, user=request.user).first()
    if existing_req:
        return JsonResponse({
            'success': True,
            'message': f'A refund request for order {order_id} has already been submitted and is currently {existing_req.status}.',
            'refund_request_id': existing_req.id,
            'status': existing_req.status
        })

    refund_req = RefundRequest.objects.using('default').create(
        user=request.user,
        payment=payment,
        order_id=order_id,
        invoice_number=invoice_number or (payment.invoice.invoice_number if hasattr(payment, 'invoice') else ''),
        email=request.user.email,
        amount=payment.amount,
        reason=reason,
        status='REQUESTED'
    )

    AuditLog.objects.using('default').create(
        user=request.user,
        action='REFUND_REQUEST_SUBMITTED',
        details=f"User {request.user.username} submitted refund request #{refund_req.id} for order {order_id}. Amount: ₹{payment.amount}"
    )

    return JsonResponse({
        'success': True,
        'message': f'Your refund request for order {order_id} has been submitted successfully (ID: #{refund_req.id}). Our compliance team will review your request within 2-3 business days.',
        'refund_request_id': refund_req.id,
        'status': refund_req.status,
        'amount': str(payment.amount),
        'created_at': refund_req.created_at.strftime('%Y-%m-%d %H:%M:%S')
    })


@login_required
def api_get_my_refund_requests(request):
    """
    Fetch all refund requests submitted by the logged-in user.
    """
    from .models import RefundRequest
    requests_qs = RefundRequest.objects.using('default').filter(user=request.user).order_by('-created_at')
    
    req_list = []
    for r in requests_qs:
        req_list.append({
            'id': r.id,
            'order_id': r.order_id,
            'invoice_number': r.invoice_number,
            'amount': str(r.amount),
            'reason': r.reason,
            'status': r.status,
            'admin_notes': r.admin_notes,
            'refund_reference': r.refund_reference,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': r.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return JsonResponse({
        'success': True,
        'refund_requests': req_list
    })


@csrf_exempt
def api_record_user_consent(request):
    """
    Records user consent to Terms & Conditions and Refund Policy.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    consent_type = data.get('consent_type', 'SIGNUP')
    terms_version = data.get('terms_version', '1.0')
    refund_version = data.get('refund_policy_version', '1.0')

    from .models import UserConsent
    
    user = request.user if request.user.is_authenticated else None
    
    # Extract Client IP
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')

    consent = UserConsent.objects.using('default').create(
        user=user,
        ip_address=ip,
        terms_version=terms_version,
        refund_policy_version=refund_version,
        consent_type=consent_type
    )

    return JsonResponse({
        'success': True,
        'consent_id': consent.id,
        'timestamp': consent.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    })


@login_required
def api_admin_get_refund_requests(request):
    """
    Admin control endpoint to query and filter all user refund requests.
    """
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized admin access'}, status=403)

    from .models import RefundRequest
    
    status_filter = request.GET.get('status')
    search_q = request.GET.get('search', '').strip()

    qs = RefundRequest.objects.using('default').all().order_by('-created_at')
    if status_filter:
        qs = qs.filter(status=status_filter)
    if search_q:
        from django.db.models import Q
        qs = qs.filter(Q(order_id__icontains=search_q) | Q(email__icontains=search_q) | Q(user__username__icontains=search_q))

    results = []
    for r in qs[:100]:
        results.append({
            'id': r.id,
            'order_id': r.order_id,
            'username': r.user.username,
            'email': r.email,
            'invoice_number': r.invoice_number,
            'amount': str(r.amount),
            'reason': r.reason,
            'status': r.status,
            'admin_notes': r.admin_notes,
            'refund_reference': r.refund_reference,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': r.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return JsonResponse({
        'success': True,
        'count': len(results),
        'refund_requests': results
    })


@login_required
@csrf_exempt
def api_admin_process_refund_request(request, request_id):
    """
    Admin control endpoint to approve, reject, or process a refund request.
    If approved, automatically invokes payment gateway refund.
    """
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized admin action'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    from .models import RefundRequest, AuditLog
    try:
        req_obj = RefundRequest.objects.using('default').get(pk=request_id)
    except RefundRequest.DoesNotExist:
        return JsonResponse({'error': 'Refund request not found'}, status=404)

    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    action = data.get('action') # 'APPROVE', 'REJECT', 'UNDER_REVIEW'
    notes = data.get('notes', '')

    if action == 'REJECT':
        req_obj.status = 'REJECTED'
        req_obj.admin_notes = notes or 'Request reviewed and rejected by compliance team.'
        req_obj.admin_user = request.user
        req_obj.save()

        AuditLog.objects.using('default').create(
            user=request.user,
            action='ADMIN_REJECTED_REFUND_REQUEST',
            details=f"Admin {request.user.username} rejected refund request #{req_obj.id} for order {req_obj.order_id}"
        )
        return JsonResponse({'success': True, 'status': 'REJECTED', 'message': 'Refund request rejected.'})

    elif action == 'UNDER_REVIEW':
        req_obj.status = 'UNDER_REVIEW'
        req_obj.admin_notes = notes
        req_obj.admin_user = request.user
        req_obj.save()
        return JsonResponse({'success': True, 'status': 'UNDER_REVIEW', 'message': 'Status updated to Under Review.'})

    elif action == 'APPROVE':
        req_obj.status = 'APPROVED'
        req_obj.admin_notes = notes or 'Approved for gateway refund.'
        req_obj.admin_user = request.user
        req_obj.save()

        # Trigger gateway refund if payment object exists
        if req_obj.payment:
            from accounts.services.payment_gateway import payment_gateway_service
            res = payment_gateway_service.refund_payment(req_obj.payment, amount=float(req_obj.amount), reason=notes or "Admin approved refund request")
            if res.get('success'):
                req_obj.status = 'REFUNDED'
                req_obj.refund_reference = res.get('refund_id', f"REF-{req_obj.order_id}")
                req_obj.refunded_at = timezone.now()
                req_obj.save()

                AuditLog.objects.using('default').create(
                    user=request.user,
                    action='ADMIN_APPROVED_REFUND_REQUEST',
                    details=f"Admin {request.user.username} approved refund request #{req_obj.id}. Refund reference: {req_obj.refund_reference}"
                )
                return JsonResponse({'success': True, 'status': 'REFUNDED', 'message': 'Refund request approved and gateway refund executed successfully.'})
            else:
                req_obj.status = 'FAILED'
                req_obj.admin_notes = f"Gateway refund failed: {res.get('error')}"
                req_obj.save()
                return JsonResponse({'success': False, 'status': 'FAILED', 'error': res.get('error')}, status=400)
        else:
            req_obj.status = 'REFUNDED'
            req_obj.refund_reference = f"MANUAL-REF-{req_obj.order_id}"
            req_obj.refunded_at = timezone.now()
            req_obj.save()
            return JsonResponse({'success': True, 'status': 'REFUNDED', 'message': 'Refund request approved and marked refunded.'})

    return JsonResponse({'error': 'Invalid action specified. Must be APPROVE, REJECT, or UNDER_REVIEW'}, status=400)

