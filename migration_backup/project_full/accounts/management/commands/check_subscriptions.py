from django.core.management.base import BaseCommand
from django.utils import timezone
import datetime
from django.contrib.auth.models import User
from accounts.models import Profile, Subscription, AuditLog
from accounts.utils import send_email_robust

class Command(BaseCommand):
    help = 'Checks subscription expirations, downgrades expired trials/plans, and sends renewal reminders.'

    def handle(self, *args, **options):
        now = timezone.now()
        self.stdout.write(f"[{now}] Starting subscription check...")

        # 1. Handle Expired Subscriptions
        expired_subs = Subscription.objects.using('default').filter(
            is_active=True,
            end_date__lte=now
        )
        
        for sub in expired_subs:
            sub.is_active = False
            sub.save()

            # Update User profile
            profile = sub.user.profile
            # Double check if user has another overlapping active subscription
            has_other_active = Subscription.objects.using('default').filter(
                user=sub.user,
                is_active=True,
                end_date__gt=now
            ).exists()

            if not has_other_active:
                profile.is_pro = False
                profile.save()

            # Log audit
            AuditLog.objects.using('default').create(
                user=sub.user,
                action='SUBSCRIPTION_EXPIRED',
                details=f"Subscription for plan {sub.plan.name if sub.plan else 'Trial'} expired on {sub.end_date}"
            )

            # Send Email Notification
            subject = "Your Subscription has Expired - PDF Powerhouse"
            body = f"Hello {sub.user.username},\n\nYour premium access has expired. Upgrade your plan at any time to regain unlimited access to all tools.\n\nThank you,\nPDF Powerhouse Team"
            try:
                send_email_robust(subject, body, sub.user.email)
            except Exception as e:
                self.stderr.write(f"Failed to send email to {sub.user.email}: {e}")

        # 2. Handle Expiring Warnings (Renewal Reminders - 3 days before expiry)
        warning_threshold = now + datetime.timedelta(days=3)
        expiring_soon = Subscription.objects.using('default').filter(
            is_active=True,
            end_date__lte=warning_threshold,
            end_date__gt=now,
            expiring_alert_sent=False
        )

        for sub in expiring_soon:
            sub.expiring_alert_sent = True
            sub.save()

            # Log audit
            AuditLog.objects.using('default').create(
                user=sub.user,
                action='SUBSCRIPTION_EXPIRING_WARNING',
                details=f"Subscription for plan {sub.plan.name if sub.plan else 'Trial'} expiring on {sub.end_date}"
            )

            # Send Email Warning
            subject = "Your Subscription is Expiring Soon - PDF Powerhouse"
            body = f"Hello {sub.user.username},\n\nYour premium subscription will expire in less than 3 days (on {sub.end_date}). Renew your subscription today to prevent any disruption in your workflow.\n\nThank you,\nPDF Powerhouse Team"
            try:
                send_email_robust(subject, body, sub.user.email)
            except Exception as e:
                self.stderr.write(f"Failed to send email to {sub.user.email}: {e}")

        # 3. Handle Expired Trials (For accounts whose trial/plan expiry has passed, with profile.is_pro = True and no paid subscription)
        expired_trials = Profile.objects.using('default').filter(
            pro_expiry__lte=now,
            is_pro=True
        )

        for profile in expired_trials:
            # Check if there is an active paid subscription
            has_paid_sub = Subscription.objects.using('default').filter(
                user=profile.user,
                is_active=True,
                end_date__gt=now
            ).exclude(plan=None).exists()

            if not has_paid_sub:
                profile.is_pro = False
                profile.save()

                # Mark any active trial subscriptions as inactive
                Subscription.objects.using('default').filter(
                    user=profile.user,
                    plan=None,
                    is_active=True
                ).update(is_active=False)

                # Log audit
                AuditLog.objects.using('default').create(
                    user=profile.user,
                    action='TRIAL_EXPIRED',
                    details=f"Free Trial expired for user joined on {profile.user.date_joined}"
                )

                # Send Expired Email
                subject = "Your Free Trial has Ended - PDF Powerhouse"
                body = f"Hello {profile.user.username},\n\nYour 7-day free trial has ended. Upgrade to Premium today to unlock unlimited processing and premium tools.\n\nThank you,\nPDF Powerhouse Team"
                try:
                    send_email_robust(subject, body, profile.user.email)
                except Exception as e:
                    self.stderr.write(f"Failed to send email to {profile.user.email}: {e}")

        self.stdout.write(self.style.SUCCESS("Subscription status audit completed successfully!"))
