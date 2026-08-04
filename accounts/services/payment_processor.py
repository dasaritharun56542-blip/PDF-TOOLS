"""
Payment Processing Core Engine.
Guarantees database consistency, automatic PRO activation, stackable subscription validity,
invoice PDF generation, transaction logs, audit logs, and notifications.
"""

import datetime
import logging
from django.db import transaction
from django.utils import timezone
from accounts.models import (
    Payment, Subscription, Invoice, Transaction, AuditLog, Profile
)

logger = logging.getLogger(__name__)

STATUS_SUCCESS = 'SUCCESS'
STATUS_FAILED = 'FAILED'
STATUS_REFUNDED = 'REFUNDED'

def process_payment_success(payment, gateway_payment_id=None, raw_response=None):
    """
    Atomic transaction for payment confirmation.
    Idempotent: Executes activation logic ONLY once per order.
    """
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment.pk)

        # Idempotency check: If already marked SUCCESS, skip re-activation
        if payment.status == STATUS_SUCCESS:
            logger.info(f"[PaymentProcessor] Order {payment.order_id} already marked SUCCESS. Skipping activation.")
            return

        payment.status = STATUS_SUCCESS
        if gateway_payment_id:
            payment.gateway_payment_id = gateway_payment_id
            payment.transaction_id = gateway_payment_id
        payment.save()

        user = payment.user
        plan = payment.plan
        now = timezone.now()

        # Stackable subscription logic
        active_sub = Subscription.objects.using('default').filter(
            user=user, is_active=True, end_date__gt=now
        ).order_by('-end_date').first()

        if active_sub:
            start_date = active_sub.end_date
        else:
            start_date = now

        duration_days = plan.duration_days if plan else 30
        end_date = start_date + datetime.timedelta(days=duration_days)

        sub = Subscription.objects.using('default').create(
            user=user,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            is_active=True
        )

        # Update User Profile
        profile, _ = Profile.objects.using('default').get_or_create(user=user)
        profile.is_pro = True
        profile.pro_expiry = end_date
        profile.save()

        # Generate Invoice Number & Record
        invoice_num = f"INV-{payment.order_id}"
        invoice, _ = Invoice.objects.using('default').get_or_create(
            user=user,
            payment=payment,
            defaults={'invoice_number': invoice_num}
        )

        # Generate PDF Invoice via ReportLab helper
        try:
            from accounts.views import generate_invoice_pdf
            generate_invoice_pdf(invoice)
        except Exception as e:
            logger.error(f"[PaymentProcessor] Invoice PDF generation error: {e}")

        # Transaction & AuditLog
        Transaction.objects.using('default').create(
            payment=payment,
            transaction_id=gateway_payment_id or payment.transaction_id or f"TXN-{payment.order_id}",
            amount=payment.amount,
            status=STATUS_SUCCESS,
            payment_method=payment.gateway_name or 'Airtel Payments Bank Settlement Gateway',
            response_code='SUCCESS',
            raw_response=str(raw_response) if raw_response else 'Server-side Payment Verification Succeeded'
        )

        AuditLog.objects.using('default').create(
            user=user,
            action='PAYMENT_SUCCESS',
            details=f"Payment for order {payment.order_id} verified as SUCCESS. Plan: {plan.name if plan else 'PRO'}, Valid: {end_date.strftime('%Y-%m-%d')}"
        )

        # Email Notifications
        try:
            from accounts.utils import send_subscription_activated_email, send_invoice_email
            send_subscription_activated_email(user, sub)
            send_invoice_email(user, invoice)
        except Exception as em:
            logger.warning(f"[PaymentProcessor] Notification email send failure: {em}")

        logger.info(f"[PaymentProcessor] Successfully processed payment {payment.order_id} and activated PRO for user {user.username}")

def process_payment_refund(payment, raw_response=None):
    """
    Atomic transaction for processing refund.
    Revokes subscription and updates records.
    """
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if payment.status == STATUS_REFUNDED:
            return

        payment.status = STATUS_REFUNDED
        payment.save()

        user = payment.user

        # Deactivate subscription matching this plan
        Subscription.objects.using('default').filter(user=user, plan=payment.plan).update(is_active=False)

        # Check if user has any other active subscriptions
        now = timezone.now()
        remaining_sub = Subscription.objects.using('default').filter(user=user, is_active=True, end_date__gt=now).order_by('-end_date').first()

        profile, _ = Profile.objects.using('default').get_or_create(user=user)
        if remaining_sub:
            profile.is_pro = True
            profile.pro_expiry = remaining_sub.end_date
        else:
            profile.is_pro = False
            profile.pro_expiry = now
        profile.save()

        Transaction.objects.using('default').create(
            payment=payment,
            transaction_id=payment.transaction_id or f"TXN-{payment.order_id}",
            amount=payment.amount,
            status=STATUS_REFUNDED,
            payment_method=payment.gateway_name or 'Gateway Refund API',
            response_code='REFUNDED',
            raw_response=str(raw_response) if raw_response else 'Refund processed'
        )

        AuditLog.objects.using('default').create(
            user=user,
            action='PAYMENT_REFUNDED',
            details=f"Payment for order {payment.order_id} refunded. Pro status updated."
        )

        logger.info(f"[PaymentProcessor] Processed refund for order {payment.order_id}, user {user.username}")
