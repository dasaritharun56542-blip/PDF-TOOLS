import os
import secrets
import time
import logging
from decimal import Decimal
from django.conf import settings
from django.core.mail import get_connection, EmailMessage, EmailMultiAlternatives
from django.utils import timezone
from .models import Profile

logger = logging.getLogger(__name__)

def send_email_robust(subject, body, to_email, html_message=None):
    """
    Sends an email with timeout configuration, retry logic, and error logging. Supports HTML messages.
    """
    from_email = settings.DEFAULT_FROM_EMAIL or 'pdftoolspowerhouse7@gmail.com'
    
    try:
        connection = get_connection(
            backend=settings.EMAIL_BACKEND,
            fail_silently=False
        )
    except Exception as e:
        logger.error(f"Failed to load email backend connection: {e}")
        raise e
        
    if html_message:
        email = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=from_email,
            to=[to_email],
            connection=connection
        )
        email.attach_alternative(html_message, "text/html")
    else:
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=from_email,
            to=[to_email],
            connection=connection
        )
    
    max_retries = 3
    retry_delay = 2 # seconds
    
    for attempt in range(1, max_retries + 1):
        try:
            email.send(fail_silently=False)
            logger.info(f"Email successfully sent to {to_email} on attempt {attempt}")
            return True
        except Exception as err:
            logger.warning(f"Attempt {attempt} failed to send email to {to_email}: {err}")
            if attempt == max_retries:
                logger.error(f"All {max_retries} attempts failed to send email to {to_email}.")
                raise err
            time.sleep(retry_delay)

def send_otp_email(user):
    """
    Generates a cryptographically secure 6-digit OTP, saves it to user's profile, and sends it.
    """
    if not user:
        raise ValueError("User object is required to send OTP email.")
    import hashlib
    profile, _ = Profile.objects.using('default').get_or_create(user=user)
    
    # Cryptographically secure random 6-digit OTP code
    otp_code = str(secrets.SystemRandom().randint(100000, 999999))
    
    # Hash OTP before storing
    hashed_otp = hashlib.sha256(otp_code.encode('utf-8')).hexdigest()
    profile.otp = hashed_otp
    profile.otp_created_at = timezone.now()
    profile.otp_attempts = 0 # reset attempts on new code
    profile.save()

    subject = 'Your Verification Code - PDF Powerhouse'
    message = f'Hello {user.username or user.email},\n\nYour one-time verification code is {otp_code}.\nIt is valid for 10 minutes.\n\nThank you,\nPDF Powerhouse Team'
    
    send_email_robust(subject, message, user.email)
    return otp_code

def send_welcome_email(user):
    """
    Sends a beautiful HTML Welcome message email upon successful signup/verification.
    """
    display_name = user.first_name or user.username or user.email.split('@')[0]
    subject = 'Welcome to PDF PowerHouse! 🎉'
    plain_text = f"Hello {display_name},\n\nWelcome to PDF PowerHouse! Your account has been verified successfully. Enjoy full access to our PDF tools.\n\nThank you,\nPDF PowerHouse Team"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #4f46e5; margin: 0; font-size: 26px; font-weight: 800;">PDF PowerHouse</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Enterprise PDF Operations Suite</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; border-radius: 8px; color: #ffffff; text-align: center; margin-bottom: 24px;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Welcome to the Family! 🎉</h2>
            <p style="margin-top: 8px; font-size: 15px; opacity: 0.9;">Hello {display_name}, your account is officially active and ready.</p>
        </div>
        
        <div style="color: #334155; line-height: 1.6; font-size: 15px;">
            <p>Thank you for signing up for <strong>PDF PowerHouse</strong>. You now have access to our full suite of professional PDF tools, including:</p>
            <ul style="padding-left: 20px; color: #475569;">
                <li><strong>Merge & Split PDFs</strong> with high fidelity</li>
                <li><strong>Compress PDFs</strong> with maximum size reduction</li>
                <li><strong>Convert Documents</strong> (PDF to Word, JPG, PNG, PDF/A)</li>
                <li><strong>Watermark, Page Numbers, OCR, & Security</strong></li>
            </ul>
            <p>Your <strong>7-Day Pro Free Trial</strong> is active. You can start editing and transforming documents immediately.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5173/dashboard" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">Go to Dashboard</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">If you have any questions or need support, feel free to reply directly to this email.</p>
    </div>
    """
    try:
        send_email_robust(subject, plain_text, user.email, html_message=html_content)
    except Exception as e:
        logger.warning(f"Failed to send welcome email to {user.email}: {e}")

def send_login_notification(user, request=None):
    """
    Sends a login notification email.
    """
    subject = 'New Login Detected - PDF Powerhouse'
    message = f'Hello {user.username or user.email},\n\nA new login was detected on your account.\n\nThank you,\nPDF Powerhouse Team'
    try:
        send_email_robust(subject, message, user.email)
    except Exception as e:
        logger.warning(f"Failed to send login notification to {user.email}: {e}")

def get_active_plan(user):
    try:
        profile = user.profile
        if profile.is_pro_active:
            return "PRO"
    except:
        pass
    return "FREE"

PLAN_FEATURES = {
    "FREE": {
        "max_files_per_day": 5,
        "max_file_size_mb": 10,
        "tools": ["MERGE", "SPLIT", "COMPRESS", "CONVERT"],
    },
    "PRO": {
        "max_files_per_day": 50,
        "max_file_size_mb": 50,
        "tools": ["MERGE", "SPLIT", "COMPRESS", "CONVERT", "WATERMARK", "SCAN"],
    },
    "BUSINESS": {
        "max_files_per_day": 500,
        "max_file_size_mb": 200,
        "tools": ["MERGE", "SPLIT", "COMPRESS", "CONVERT", "WATERMARK", "SCAN"],
    },
}

def get_plan_features(user):
    plan = get_active_plan(user)
    return PLAN_FEATURES.get(plan, PLAN_FEATURES["FREE"])

def send_payment_failed_email(user, payment):
    subject = "Payment Failed - PDF Powerhouse"
    body = f"Hello {user.username},\n\nWe were unable to process your payment of ₹{payment.amount} for the plan '{payment.plan.name if payment.plan else 'Premium'}'. Please try again or use another payment method.\n\nThank you,\nPDF Powerhouse Team"
    try:
        send_email_robust(subject, body, user.email)
    except Exception as e:
        logger.warning(f"Failed to send payment failure email to {user.email}: {e}")

def send_subscription_activated_email(user, subscription):
    plan_name = subscription.plan.name if subscription.plan else "Free Trial"
    subject = "Premium Subscription Activated! - PDF Powerhouse"
    body = f"Hello {user.username},\n\nCongratulations! Your subscription to the plan '{plan_name}' has been activated successfully.\n\nStart date: {subscription.start_date.strftime('%Y-%m-%d %H:%M:%S')}\nExpiry date: {subscription.end_date.strftime('%Y-%m-%d %H:%M:%S')}\n\nAll premium features are now unlocked instantly!\n\nThank you,\nPDF Powerhouse Team"
    try:
        send_email_robust(subject, body, user.email)
    except Exception as e:
        logger.warning(f"Failed to send activation email to {user.email}: {e}")

def send_invoice_email(user, invoice):
    subject = f"Invoice {invoice.invoice_number} for your PDF Powerhouse Subscription"
    body = f"Hello {user.username},\n\nThank you for your purchase! Please find attached the official tax invoice ({invoice.invoice_number}) for your subscription.\n\nThank you for choosing PDF Powerhouse,\nPDF Powerhouse Team"
    
    from_email = settings.DEFAULT_FROM_EMAIL or 'pdftoolspowerhouse@gmail.com'
    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=from_email,
        to=[user.email]
    )
    
    if invoice.pdf_file:
        try:
            invoice.pdf_file.seek(0)
            email.attach(f"invoice_{invoice.invoice_number}.pdf", invoice.pdf_file.read(), 'application/pdf')
        except Exception as e:
            logger.error(f"Failed to attach invoice PDF: {e}")
            
    try:
        email.send(fail_silently=False)
        return True
    except Exception as err:
        logger.error(f"Failed to send invoice email to {user.email}: {err}")
        return False

def activate_free_trial(user):
    """
    Automatically creates/updates a Subscription record for a verified user and updates their Profile to is_pro=True
    with a pro_expiry date set to 7 days from now.
    """
    from accounts.models import Profile, Subscription, AuditLog
    from django.utils import timezone
    import datetime

    profile, _ = Profile.objects.get_or_create(user=user)
    
    if not profile.trial_used:
        now = timezone.now()
        end_date = now + datetime.timedelta(days=7)
        
        # 1. Update Profile
        profile.is_pro = True
        profile.pro_expiry = end_date
        profile.trial_used = True
        profile.save()
        
        # 2. Update or Create Subscription (ensure plan=None)
        sub, created = Subscription.objects.get_or_create(
            user=user,
            plan=None,
            defaults={
                'start_date': now,
                'end_date': end_date,
                'is_active': True
            }
        )
        if not created:
            sub.start_date = now
            sub.end_date = end_date
            sub.is_active = True
            sub.save()
            
        # 3. Log Audit
        AuditLog.objects.create(
            user=user,
            action='TRIAL_ACTIVATED',
            details=f"Free Trial subscription activated automatically for user {user.username} from {now} to {end_date}."
        )
