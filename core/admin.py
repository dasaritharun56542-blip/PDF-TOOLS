from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import UploadedFile, ProcessedFile, ToolUsageLog, DownloadHistory
from .secure_storage import SecureStorageManager

storage_mgr = SecureStorageManager()

@admin.action(description='Bulk delete selected files from secure storage and database')
def bulk_delete_files(modeladmin, request, queryset):
    deleted_count = 0
    for obj in queryset:
        rel_path = getattr(obj, 'storage_path', None) or getattr(obj.file, 'name', None)
        if rel_path:
            storage_mgr.delete_file(rel_path)
        obj.delete()
        deleted_count += 1
    modeladmin.message_user(request, f"Successfully deleted {deleted_count} files from secure storage.")

@admin.register(UploadedFile)
class UploadedFileAdmin(admin.ModelAdmin):
    list_display = ('id', 'filename', 'stored_filename', 'get_user_email', 'size', 'file_type', 'checksum', 'upload_date', 'admin_download', 'admin_preview')
    search_fields = ('filename', 'stored_filename', 'checksum', 'user__email', 'user__username')
    list_filter = ('file_type', 'upload_date')
    actions = [bulk_delete_files]

    def get_user_email(self, obj):
        return obj.user_email
    get_user_email.short_description = 'User Email'

    def admin_download(self, obj):
        url = reverse('api_admin_file_preview', kwargs={'category': 'uploaded', 'file_id': obj.id})
        return format_html('<a class="button" href="{}" target="_blank">Download</a>', url)
    admin_download.short_description = 'Download'

    def admin_preview(self, obj):
        url = reverse('api_admin_file_preview', kwargs={'category': 'uploaded', 'file_id': obj.id})
        return format_html('<a class="button" href="{}" target="_blank">Preview</a>', url)
    admin_preview.short_description = 'Preview'


@admin.register(ProcessedFile)
class ProcessedFileAdmin(admin.ModelAdmin):
    list_display = ('id', 'filename', 'tool_used', 'status', 'get_user_email', 'file_size', 'file_type', 'checksum', 'process_date', 'admin_download', 'admin_preview')
    search_fields = ('filename', 'stored_filename', 'checksum', 'user__email', 'user__username', 'tool_used', 'task_id')
    list_filter = ('status', 'tool_used', 'file_type', 'process_date')
    actions = [bulk_delete_files]

    def get_user_email(self, obj):
        return obj.user_email
    get_user_email.short_description = 'User Email'

    def admin_download(self, obj):
        if obj.status == 'completed':
            url = reverse('download_file', kwargs={'file_id': obj.id})
            return format_html('<a class="button" href="{}" target="_blank">Download</a>', url)
        return "-"
    admin_download.short_description = 'Download'

    def admin_preview(self, obj):
        if obj.status == 'completed':
            url = reverse('api_admin_file_preview', kwargs={'category': 'processed', 'file_id': obj.id})
            return format_html('<a class="button" href="{}" target="_blank">Preview</a>', url)
        return "-"
    admin_preview.short_description = 'Preview'


@admin.register(ToolUsageLog)
class ToolUsageLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'tool_name', 'status', 'duration_seconds', 'timestamp')
    search_fields = ('tool_name', 'status', 'user__email', 'user__username')
    list_filter = ('status', 'tool_name', 'timestamp')


@admin.register(DownloadHistory)
class DownloadHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'processed_file', 'download_date')
    search_fields = ('processed_file__filename', 'user__email', 'user__username')
    list_filter = ('download_date',)
