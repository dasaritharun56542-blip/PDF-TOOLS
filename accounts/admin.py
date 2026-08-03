from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import (
    Profile, PaymentRecord, AuthLog, Plan, Subscription,
    Payment, Invoice, DailyUsage, Transaction, WebhookLog, AuditLog, PasswordResetOTP
)

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'invoice_number', 'get_user_username', 'get_user_email',
        'get_amount', 'get_payment_status', 'created_at', 'admin_download_pdf'
    )
    search_fields = ('invoice_number', 'user__username', 'user__email', 'payment__order_id', 'payment__transaction_id')
    list_filter = ('created_at',)
    readonly_fields = ('created_at', 'admin_download_pdf')
    ordering = ('-created_at',)

    def get_user_username(self, obj):
        return obj.user.username
    get_user_username.short_description = 'User'

    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User Email'

    def get_amount(self, obj):
        return f"₹{obj.payment.amount}" if obj.payment else "-"
    get_amount.short_description = 'Amount'

    def get_payment_status(self, obj):
        if not obj.payment:
            return "-"
        status = obj.payment.status
        color = 'green' if status == 'success' else ('red' if status == 'failed' else 'orange')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, status.upper())
    get_payment_status.short_description = 'Payment Status'

    def admin_download_pdf(self, obj):
        if obj.pdf_file:
            return format_html('<a class="button" href="{}" target="_blank">Download PDF</a>', obj.pdf_file.url)
        url = reverse('download_invoice', kwargs={'invoice_id': obj.id})
        return format_html('<a class="button" href="{}" target="_blank">Generate & Download PDF</a>', url)
    admin_download_pdf.short_description = 'Invoice PDF'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order_id', 'transaction_id', 'user', 'plan', 'amount', 'get_colored_status', 'created_at')
    search_fields = ('order_id', 'transaction_id', 'user__username', 'user__email', 'plan__name')
    list_filter = ('status', 'created_at', 'plan')
    ordering = ('-created_at',)

    def get_colored_status(self, obj):
        color = 'green' if obj.status == 'success' else ('red' if obj.status == 'failed' else 'orange')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.status.upper())
    get_colored_status.short_description = 'Status'


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'plan', 'start_date', 'end_date', 'is_active', 'days_left')
    search_fields = ('user__username', 'user__email', 'plan__name')
    list_filter = ('is_active', 'start_date', 'end_date')
    ordering = ('-end_date',)

    def days_left(self, obj):
        from django.utils import timezone
        if not obj.end_date or obj.end_date <= timezone.now():
            return "0 days"
        delta = obj.end_date - timezone.now()
        return f"{delta.days} days"
    days_left.short_description = 'Validity Remaining'


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'transaction_id', 'payment', 'amount', 'payment_method', 'status', 'created_at')
    search_fields = ('transaction_id', 'payment__order_id', 'payment_method', 'response_code')
    list_filter = ('status', 'payment_method', 'created_at')
    ordering = ('-created_at',)


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'price', 'duration_days')
    search_fields = ('name',)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'is_pro', 'pro_expiry', 'trial_used', 'is_verified')
    search_fields = ('user__username', 'user__email')
    list_filter = ('is_pro', 'trial_used', 'is_verified')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'action', 'ip_address', 'timestamp')
    search_fields = ('action', 'details', 'user__username', 'user__email')
    list_filter = ('action', 'timestamp')
    ordering = ('-timestamp',)


@admin.register(WebhookLog)
class WebhookLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'received_at', 'signature_valid', 'processed', 'error_message')
    list_filter = ('signature_valid', 'processed', 'received_at')
    ordering = ('-received_at',)


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'amount', 'plan_name', 'payment_method', 'status', 'transaction_id', 'created_at')
    search_fields = ('user__username', 'plan_name', 'transaction_id')
    list_filter = ('status', 'payment_method', 'created_at')


@admin.register(AuthLog)
class AuthLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'action', 'ip_address', 'timestamp')
    search_fields = ('user__username', 'action')
    list_filter = ('action', 'timestamp')
