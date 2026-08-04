from django.db import models

class RenderedDocument(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    original_file = models.FileField(upload_to='uploads/')
    pdf_output = models.FileField(upload_to='rendered_pdfs/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"RenderedDocument #{self.id} ({self.status})"
