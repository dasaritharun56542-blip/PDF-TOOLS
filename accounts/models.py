from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import datetime

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=255, blank=True, null=True)
    otp_created_at = models.DateTimeField(blank=True, null=True)
    otp_attempts = models.IntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    is_pro = models.BooleanField(default=False)
    pro_expiry = models.DateTimeField(blank=True, null=True)
    trial_used = models.BooleanField(default=False)
    stripe_customer_id = models.CharField(max_length=100, blank=True, null=True)
    subscription_id = models.CharField(max_length=100, blank=True, null=True)

    @property
    def is_pro_active(self):
        if self.is_pro and self.pro_expiry and self.pro_expiry > timezone.now():
            return True
        try:
            from accounts.models import Subscription
            if Subscription.objects.filter(user=self.user, is_active=True, end_date__gt=timezone.now()).exists():
                return True
        except:
            pass
        return False

    @property
    def days_remaining(self):
        if not self.is_pro_active:
            return 0
        expiry = self.pro_expiry
        if not expiry:
            try:
                from accounts.models import Subscription
                sub = Subscription.objects.filter(user=self.user, is_active=True, end_date__gt=timezone.now()).order_by('-end_date').first()
                if sub:
                    expiry = sub.end_date
            except:
                pass
        if not expiry:
            return 0
        delta = expiry - timezone.now()
        return max(0, delta.days)

    def is_otp_valid(self):
        if not self.otp or not self.otp_created_at:
            return False
        # OTP valid for 10 minutes
        return timezone.now() < self.otp_created_at + datetime.timedelta(minutes=10)

    def can_resend_otp(self):
        if not self.otp_created_at:
            return True
        # 60 seconds cooldown
        return timezone.now() >= self.otp_created_at + datetime.timedelta(seconds=60)

    def get_resend_cooldown_seconds(self):
        if not self.otp_created_at:
            return 0
        delta = (self.otp_created_at + datetime.timedelta(seconds=60)) - timezone.now()
        return max(0, int(delta.total_seconds()))

    def __str__(self):
        return self.user.username

class PaymentRecord(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    plan_name = models.CharField(max_length=50)
    payment_method = models.CharField(max_length=20) # 'stripe', 'upi'
    status = models.CharField(max_length=20, default='pending')
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.plan_name} - {self.status}"

class AuthLog(models.Model):
    ACTION_CHOICES = [
        ('LOGIN', 'Login'),
        ('SIGNUP', 'Signup'),
        ('LOGOUT', 'Logout'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.action} - {self.timestamp}"

from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        profile, _ = Profile.objects.using('default').get_or_create(user=instance)
        try:
            from django.apps import apps
            import datetime
            Subscription = apps.get_model('accounts', 'Subscription')
            end_date = instance.date_joined + datetime.timedelta(days=7)
            Subscription.objects.using('default').get_or_create(
                user=instance,
                plan=None,
                start_date=instance.date_joined,
                end_date=end_date,
                is_active=True
            )
            profile.is_pro = True
            profile.pro_expiry = end_date
            profile.trial_used = True
            profile.save()
        except Exception as e:
            pass

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    Profile.objects.using('default').get_or_create(user=instance)

class Plan(models.Model):
    name = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField()
    
    def __str__(self):
        return f"{self.name} - ₹{self.price}"

class Subscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, null=True, blank=True)
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    expiring_alert_sent = models.BooleanField(default=False)
    expired_alert_sent = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.plan.name if self.plan else 'Trial'}"

class Payment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, null=True, blank=True)
    order_id = models.CharField(max_length=100, unique=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending') # 'pending', 'success', 'failed'
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.order_id} - {self.status}"

class Invoice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    payment = models.OneToOneField(Payment, on_delete=models.CASCADE)
    invoice_number = models.CharField(max_length=50, unique=True)
    pdf_file = models.FileField(upload_to='invoices/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.invoice_number

class DailyUsage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.now)
    processing_time_seconds = models.IntegerField(default=0)
    upload_count = models.IntegerField(default=0)
    download_count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('user', 'date')

    def __str__(self):
        return f"{self.user.username} - {self.date} - {self.processing_time_seconds}s"

class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField()

    def __str__(self):
        return f"{self.name} - ₹{self.price}"

class Transaction(models.Model):
    payment = models.ForeignKey('Payment', on_delete=models.CASCADE, related_name='transactions_list')
    transaction_id = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20)
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    response_code = models.CharField(max_length=50, blank=True, null=True)
    raw_response = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_id} - {self.status}"

class WebhookLog(models.Model):
    received_at = models.DateTimeField(auto_now_add=True)
    payload = models.TextField()
    headers = models.TextField(blank=True, null=True)
    signature_valid = models.BooleanField(default=False)
    processed = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Webhook at {self.received_at}"

class UsageHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.now)
    tool_name = models.CharField(max_length=50)
    processing_time_seconds = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default='success')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.tool_name} - {self.date}"

class ToolUsage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    tool_name = models.CharField(max_length=50)
    use_count = models.IntegerField(default=0)
    last_used = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.tool_name} - {self.use_count}"

class ProcessingTime(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.now)
    duration_seconds = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - {self.date} - {self.duration_seconds}s"

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    action = models.CharField(max_length=100)
    details = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} - {self.timestamp}"

class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_otps')
    otp = models.CharField(max_length=10)
    reset_token = models.CharField(max_length=100, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        if self.is_used or self.attempts >= 5:
            return False
        return timezone.now() < self.created_at + datetime.timedelta(minutes=10)

    def __str__(self):
        return f"PasswordResetOTP for {self.user.username} - {self.otp}"
