import stripe, os, datetime, json, secrets, requests, hashlib
from django.utils import timezone
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate
from django.contrib import messages
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from .forms import CustomUserCreationForm, CustomAuthenticationForm
from .utils import send_otp_email, send_welcome_email, send_login_notification
from .models import Profile, AuthLog, Plan, Subscription, Payment, Invoice

stripe.api_key = settings.STRIPE_SECRET_KEY

SUBSCRIPTION_PLANS = [
    {'id': '1_month', 'days': 30, 'price': 40, 'name': '1 Month Pro'},
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
            import urllib.parse
            plan_name = plan.name if plan else 'Pro Plan'
            upi_link = f"upi://pay?pa={upi_id}&pn=PDFPowerHouse&am={payment.amount}&cu=INR&tn={urllib.parse.quote(plan_name)}"
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
    amount = plan['price']
    name = plan['name']
    import urllib.parse
    upi_link = f"upi://pay?pa={upi_id}&pn=PDFPowerHouse&am={amount}&cu=INR&tn={urllib.parse.quote(name)}"
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

                return JsonResponse({
                    'success': True,
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

    if request.user.is_authenticated:
        try:
            profile = request.user.profile
            if not profile.trial_used:
                from .utils import activate_free_trial
                activate_free_trial(request.user)
                profile.refresh_from_db()
            avatar_url = None
            google_name = None
            try:
                from allauth.socialaccount.models import SocialAccount
                social_acc = SocialAccount.objects.filter(user=request.user, provider='google').first()
                if social_acc:
                    avatar_url = social_acc.extra_data.get('picture')
                    google_name = social_acc.extra_data.get('name')
            except Exception:
                pass

            return JsonResponse({
                'authenticated': True,
                'google_client_id': client_id,
                'user': {
                    'username': request.user.username,
                    'email': request.user.email,
                    'is_pro': profile.is_pro_active,
                    'days_left': profile.days_remaining,
                    'trial_used': profile.trial_used,
                    'avatar_url': avatar_url,
                    'google_name': google_name
                }
            })
        except Exception as e:
            return JsonResponse({
                'authenticated': False,
                'google_client_id': client_id
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

    client_id = settings.SOCIALACCOUNT_PROVIDERS.get('google', {}).get('APP', {}).get('client_id', '').strip()

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
        social_app, _ = SocialApp.objects.using('default').update_or_create(
            provider='google',
            defaults={
                'name': 'Google',
                'client_id': client_id,
                'secret': os.getenv('GOOGLE_CLIENT_SECRET', '')
            }
        )
        social_acc, _ = SocialAccount.objects.using('default').get_or_create(
            user=user,
            provider='google',
            defaults={
                'uid': google_id,
                'extra_data': {
                    'email': email,
                    'name': name,
                    'picture': picture,
                    'email_verified': True
                }
            }
        )
        if social_acc.extra_data.get('picture') != picture or social_acc.extra_data.get('name') != name:
            social_acc.extra_data['picture'] = picture
            social_acc.extra_data['name'] = name
            social_acc.save()
    except Exception:
        pass

    login(request, user, backend='django.contrib.auth.backends.ModelBackend')

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

@login_required
@csrf_exempt
def phonepe_initiate_payment(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=400)
        
    try:
        data = json.loads(request.body)
        plan_id = data.get('plan_id')
    except:
        plan_id = request.POST.get('plan_id')
        
    if not plan_id:
        return JsonResponse({'error': 'plan_id is required'}, status=400)
        
    plan_mapping = {
        '1_month': 30,
        '3_months': 90,
        '6_months': 180,
        '1_year': 365
    }
    
    duration = plan_mapping.get(plan_id)
    plan = None
    if duration:
        plan = Plan.objects.using('default').filter(duration_days=duration).first()
    if not plan:
        try:
            plan = Plan.objects.using('default').get(pk=plan_id)
        except:
            plan = None
            
    if not plan:
        plan_info = next((p for p in SUBSCRIPTION_PLANS if p['id'] == plan_id), None)
        if plan_info:
            plan, _ = Plan.objects.using('default').get_or_create(
                duration_days=plan_info['days'],
                defaults={
                    'name': plan_info['name'],
                    'price': plan_info['price']
                }
            )
        else:
            return JsonResponse({'error': 'Invalid subscription plan selected'}, status=400)
        
    order_id = f"ORD_{secrets.token_hex(8).upper()}"
    
    payment = Payment.objects.using('default').create(
        user=request.user,
        plan=plan,
        order_id=order_id,
        amount=plan.price,
        status='pending'
    )
    
    upi_id = os.getenv('UPI_ID', '9110396906@ybl')
    import urllib.parse
    upi_link = f"upi://pay?pa={upi_id}&pn=PDFPowerHouse&am={plan.price}&cu=INR&tn={urllib.parse.quote(plan.name)}"
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(upi_link)}"

    payload = {
        "merchantId": getattr(settings, 'PHONEPE_MERCHANT_ID', 'TEST'),
        "merchantTransactionId": order_id,
        "merchantUserId": f"USER_{request.user.id}",
        "amount": int(plan.price * 100),
        "redirectUrl": getattr(settings, 'PHONEPE_REDIRECT_URL', 'http://localhost:5173/accounts/payment-success'),
        "redirectMode": "POST",
        "callbackUrl": getattr(settings, 'PHONEPE_CALLBACK_URL', 'http://localhost:8000/accounts/phonepe/webhook/'),
        "paymentInstrument": {
            "type": "PAY_PAGE"
        }
    }
    
    try:
        payload_json = json.dumps(payload)
        payload_base64 = base64.b64encode(payload_json.encode('utf-8')).decode('utf-8')
        string_to_hash = payload_base64 + "/pg/v1/pay" + getattr(settings, 'PHONEPE_SALT_KEY', 'TEST_SALT')
        checksum = hashlib.sha256(string_to_hash.encode('utf-8')).hexdigest()
        x_verify = f"{checksum}###{getattr(settings, 'PHONEPE_SALT_INDEX', '1')}"
        
        headers = {
            "Content-Type": "application/json",
            "X-VERIFY": x_verify
        }
        url = get_phonepe_url("/pg/v1/pay")
        response = requests.post(url, json={"request": payload_base64}, headers=headers, timeout=5)
        resp_data = response.json()
    except Exception as e:
        resp_data = {}
        
    if resp_data.get('success'):
        redirect_url = resp_data['data']['instrumentResponse']['redirectInfo']['url']
        return JsonResponse({
            'success': True,
            'redirect_url': redirect_url,
            'order_id': order_id,
            'plan_name': plan.name,
            'amount': float(plan.price),
            'upi_id': upi_id,
            'upi_link': upi_link,
            'qr_url': qr_url
        })
    else:
        return JsonResponse({
            'success': True,
            'order_id': order_id,
            'plan_name': plan.name,
            'amount': float(plan.price),
            'upi_id': upi_id,
            'upi_link': upi_link,
            'qr_url': qr_url
        })

@login_required
@csrf_exempt
def submit_payment_request(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
        
    try:
        data = json.loads(request.body)
        order_id = data.get('order_id')
    except Exception:
        order_id = request.POST.get('order_id')
        
    if not order_id:
        return JsonResponse({'error': 'order_id is required'}, status=400)
        
    try:
        payment = Payment.objects.using('default').get(order_id=order_id, user=request.user)
    except Payment.DoesNotExist:
        return JsonResponse({'error': 'Payment order not found.'}, status=404)
        
    ref_number = f"REQ_{secrets.token_hex(4).upper()}"
    
    process_successful_payment(payment, f"MANUAL-{ref_number}")
    
    try:
        from accounts.models import AuditLog
        AuditLog.objects.using('default').create(
            user=request.user,
            action='MANUAL_PAYMENT_SUBMITTED',
            details=f"Payment request submitted for order {order_id}. Ref: {ref_number}"
        )
    except Exception:
        pass
        
    return JsonResponse({
        'success': True,
        'message': 'Payment Confirmation received! PRO Subscription activated successfully.',
        'reference_number': ref_number
    })

@csrf_exempt
def phonepe_webhook(request):
    if request.method != 'POST':
        return HttpResponse("Method not allowed", status=405)
        
    raw_body = request.body.decode('utf-8')
    x_verify = request.headers.get('X-VERIFY')
    
    from accounts.models import WebhookLog, Transaction, AuditLog
    from accounts.utils import send_payment_failed_email
    from decimal import Decimal
    
    webhook_log = WebhookLog.objects.using('default').create(
        payload=raw_body,
        headers=str(dict(request.headers)),
        signature_valid=False,
        processed=False
    )
    
    try:
        data = json.loads(request.body)
        base64_response = data.get('response')
    except:
        webhook_log.error_message = "Invalid request body format"
        webhook_log.save()
        return HttpResponse("Invalid request body", status=400)
        
    if not base64_response or not x_verify:
        webhook_log.error_message = "Missing base64 response or signature header"
        webhook_log.save()
        return HttpResponse("Missing response or signature", status=400)
        
    string_to_hash = base64_response + settings.PHONEPE_SALT_KEY
    checksum = hashlib.sha256(string_to_hash.encode('utf-8')).hexdigest()
    expected_x_verify = f"{checksum}###{settings.PHONEPE_SALT_INDEX}"
    
    if x_verify != expected_x_verify:
        webhook_log.error_message = "Signature mismatch"
        webhook_log.save()
        return HttpResponse("Signature mismatch", status=400)
        
    webhook_log.signature_valid = True
    webhook_log.save()
    
    try:
        decoded_bytes = base64.b64decode(base64_response)
        resp_payload = json.loads(decoded_bytes.decode('utf-8'))
    except Exception as e:
        webhook_log.error_message = f"Invalid base64 payload: {str(e)}"
        webhook_log.save()
        return HttpResponse("Invalid base64 payload", status=400)
        
    success = resp_payload.get('success')
    code = resp_payload.get('code')
    resp_data = resp_payload.get('data', {})
    order_id = resp_data.get('merchantTransactionId')
    txn_id = resp_data.get('transactionId')
    
    try:
        payment = Payment.objects.using('default').get(order_id=order_id)
    except Payment.DoesNotExist:
        webhook_log.error_message = f"Payment order {order_id} not found"
        webhook_log.save()
        return HttpResponse("Payment order not found", status=404)
        
    if payment.status == 'success' and code == 'PAYMENT_SUCCESS':
        webhook_log.processed = True
        webhook_log.save()
        return JsonResponse({"status": "OK", "message": "Already processed"})
        
    phonepe_paise = resp_data.get('amount')
    if phonepe_paise:
        phonepe_amount = Decimal(phonepe_paise) / Decimal('100.00')
        if abs(phonepe_amount - payment.amount) > Decimal('0.01'):
            webhook_log.error_message = f"Amount mismatch. PhonePe: {phonepe_amount}, Local order: {payment.amount}"
            webhook_log.save()
            
            AuditLog.objects.using('default').create(
                user=payment.user,
                action='FRAUD_ALERT',
                details=f"Payment amount mismatch for order {order_id}. Webhook specified {phonepe_amount} but order expected {payment.amount}"
            )
            return HttpResponse("Amount mismatch", status=400)

    if success and code == 'PAYMENT_SUCCESS':
        process_successful_payment(payment, txn_id)
    elif code in ['PAYMENT_ERROR', 'PAYMENT_DECLINED', 'TIMED_OUT']:
        payment.status = 'failed'
        if txn_id:
            payment.transaction_id = txn_id
        payment.save()
        
        Transaction.objects.using('default').create(
            payment=payment,
            transaction_id=txn_id or f"TXN-{order_id}",
            amount=payment.amount,
            status='failed',
            payment_method='PhonePe',
            response_code=code,
            raw_response=json.dumps(resp_payload)
        )
        AuditLog.objects.using('default').create(
            user=payment.user,
            action='PAYMENT_FAILED',
            details=f"Payment failed with code {code} for order {order_id}"
        )
        send_payment_failed_email(payment.user, payment)
    elif code in ['REFUND_SUCCESSFUL', 'REFUND', 'PAYMENT_REFUNDED']:
        payment.status = 'refunded'
        payment.save()
        
        Subscription.objects.using('default').filter(user=payment.user, plan=payment.plan).update(is_active=False)
        profile = payment.user.profile
        profile.is_pro = False
        profile.save()
        
        Transaction.objects.using('default').create(
            payment=payment,
            transaction_id=txn_id or f"TXN-{order_id}",
            amount=payment.amount,
            status='refunded',
            payment_method='PhonePe',
            response_code=code,
            raw_response=json.dumps(resp_payload)
        )
        AuditLog.objects.using('default').create(
            user=payment.user,
            action='PAYMENT_REFUNDED',
            details=f"Payment refunded with code {code} for order {order_id}. Premium features disabled."
        )
        subject = "Subscription Refunded - PDF Powerhouse"
        body = f"Hello {payment.user.username},\n\nYour payment for the subscription order {order_id} has been refunded successfully. Your premium features have been deactivated.\n\nThank you,\nPDF Powerhouse Team"
        try:
            from accounts.utils import send_email_robust
            send_email_robust(subject, body, payment.user.email)
        except:
            pass
            
    webhook_log.processed = True
    webhook_log.save()
    return JsonResponse({"status": "OK"})

@csrf_exempt
def phonepe_redirect_callback(request):
    order_id = None
    if request.method == 'POST':
        order_id = request.POST.get('transactionId') or request.POST.get('merchantTransactionId')
    else:
        order_id = request.GET.get('transactionId') or request.GET.get('merchantTransactionId')
        
    if not order_id:
        try:
            body = request.POST.get('response', '')
            if body:
                decoded = json.loads(base64.b64decode(body).decode('utf-8'))
                order_id = decoded.get('data', {}).get('merchantTransactionId')
        except:
            pass
            
    if not order_id:
        return HttpResponse("Transaction ID not provided.", status=400)
        
    try:
        payment = Payment.objects.using('default').get(order_id=order_id)
    except Payment.DoesNotExist:
        return HttpResponse("Payment order not found.", status=404)
        
    txn_status = check_phonepe_txn_status(order_id)
    if txn_status and txn_status.get('success') and txn_status.get('code') == 'PAYMENT_SUCCESS':
        txn_id = txn_status.get('data', {}).get('transactionId')
        process_successful_payment(payment, txn_id)
    else:
        if txn_status:
            payment.status = 'failed'
            payment.save()
            
    redirect_url = f"{settings.PHONEPE_REDIRECT_URL}?order_id={order_id}"
    return HttpResponseRedirect(redirect_url)

@login_required
def payment_status_api(request, order_id):
    try:
        payment = Payment.objects.using('default').get(order_id=order_id, user=request.user)
        return JsonResponse({
            'success': True,
            'status': payment.status,
            'amount': payment.amount,
            'plan_name': payment.plan.name if payment.plan else 'Premium'
        })
    except Payment.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Payment record not found'}, status=404)

@login_required
def download_invoice(request, invoice_id):
    try:
        invoice = Invoice.objects.using('default').get(pk=invoice_id, user=request.user)
        if not invoice.pdf_file:
            generate_invoice_pdf(invoice)
        return FileResponse(open(invoice.pdf_file.path, 'rb'), as_attachment=True, filename=f"invoice_{invoice.invoice_number}.pdf")
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
