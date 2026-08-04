from django.db import models
from django.contrib.auth.models import User
import os
import uuid

class UploadedFile(models.Model):
    user = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True, db_column='user_id', db_constraint=False)
    file = models.FileField(upload_to='uploaded/%Y/%m/%d/')
    filename = models.CharField(max_length=255)
    stored_filename = models.CharField(max_length=255, blank=True, null=True)
    storage_path = models.CharField(max_length=500, blank=True, null=True)
    checksum = models.CharField(max_length=64, blank=True, null=True)
    file_type = models.CharField(max_length=50, blank=True, null=True)
    upload_date = models.DateTimeField(auto_now_add=True)
    size = models.BigIntegerField()

    @property
    def user_email(self):
        if self.user:
            return self.user.email or self.user.username
        return "Guest / Anonymous"

    def __str__(self):
        return self.filename

class ProcessedFile(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    user = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True, db_column='user_id', db_constraint=False)
    task_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    original_file = models.ForeignKey(UploadedFile, on_delete=models.SET_NULL, null=True)
    file = models.FileField(upload_to='processed/%Y/%m/%d/', null=True, blank=True)
    filename = models.CharField(max_length=255)
    stored_filename = models.CharField(max_length=255, blank=True, null=True)
    storage_path = models.CharField(max_length=500, blank=True, null=True)
    checksum = models.CharField(max_length=64, blank=True, null=True)
    file_type = models.CharField(max_length=50, blank=True, null=True)
    file_size = models.BigIntegerField(default=0)
    tool_used = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(null=True, blank=True)
    process_date = models.DateTimeField(auto_now_add=True)

    @property
    def user_email(self):
        if self.user:
            return self.user.email or self.user.username
        return "Guest / Anonymous"

    def __str__(self):
        return f"{self.filename} - {self.status}"

class ToolUsageLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True, db_column='user_id', db_constraint=False)
    tool_name = models.CharField(max_length=50)
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='success')
    duration_seconds = models.IntegerField(default=0)

    def __str__(self):
        if self.user_id:
            return f"{self.tool_name} by User {self.user_id}"
        return f"{self.tool_name} by Anonymous"

class DownloadHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True, db_column='user_id', db_constraint=False)
    processed_file = models.ForeignKey(ProcessedFile, on_delete=models.CASCADE)
    download_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.processed_file.filename} downloaded"
