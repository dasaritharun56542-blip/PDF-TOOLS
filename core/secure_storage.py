import os
import re
import hashlib
import uuid
import shutil
import logging
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)

class SecureStorageManager:
    """
    Enterprise Secure Storage Manager with Supabase Storage Integration & Local Fallback.
    Enforces file storage outside the application directory, filename randomization,
    SHA256 checksum computation, file metadata management, and dual-layer persistence.
    """
    def __init__(self):
        self.base_dir = Path(getattr(settings, 'SECURE_ADMIN_STORAGE_DIR', Path.home() / '.secure_admin_storage'))
        self.base_dir.mkdir(parents=True, exist_ok=True)
        (self.base_dir / 'uploaded').mkdir(parents=True, exist_ok=True)
        (self.base_dir / 'processed').mkdir(parents=True, exist_ok=True)
        (self.base_dir / 'invoices').mkdir(parents=True, exist_ok=True)

        self._sup_service = None

    @property
    def supabase_service(self):
        if self._sup_service is None:
            try:
                from accounts.services.supabase_storage import SupabaseStorageService
                self._sup_service = SupabaseStorageService()
            except Exception as e:
                logger.warning(f"SupabaseStorageService initialization warning: {e}")
                self._sup_service = None
        return self._sup_service

    def calculate_checksum(self, file_path_or_bytes):
        sha256 = hashlib.sha256()
        if isinstance(file_path_or_bytes, (str, Path)):
            with open(file_path_or_bytes, 'rb') as f:
                for chunk in iter(lambda: f.read(65536), b''):
                    sha256.update(chunk)
        elif hasattr(file_path_or_bytes, 'read'):
            pos = file_path_or_bytes.tell() if hasattr(file_path_or_bytes, 'tell') else 0
            for chunk in iter(lambda: file_path_or_bytes.read(65536), b''):
                sha256.update(chunk)
            if hasattr(file_path_or_bytes, 'seek'):
                file_path_or_bytes.seek(pos)
        elif isinstance(file_path_or_bytes, bytes):
            sha256.update(file_path_or_bytes)
        return sha256.hexdigest()

    def get_absolute_path(self, relative_storage_path):
        clean_path = str(relative_storage_path).replace('\\', '/').lstrip('/')
        abs_path = (self.base_dir / clean_path).resolve()
        # Security: Prevent Directory Traversal
        if not str(abs_path).startswith(str(self.base_dir.resolve())):
            raise ValueError("Access Denied: Attempted path traversal out of secure admin storage.")
        return abs_path

    def get_supabase_storage_path(self, relative_storage_path, user_id=None) -> str:
        """
        Maps a local relative storage path (e.g. 'uploaded/uuid.pdf' or 'processed/uuid.pdf')
        to the required Supabase Storage format:
        - uploads/user_<USER_ID>/<filename>
        - processed/user_<USER_ID>/<filename>
        - invoices/user_<USER_ID>/<filename>
        """
        clean_path = str(relative_storage_path).replace('\\', '/').lstrip('/')
        
        # If already formatted as uploads/user_X/..., processed/user_X/..., or invoices/user_X/..., validate and return directly
        if re.match(r'^(uploads|processed|invoices)/user_\d+/', clean_path):
            from accounts.services.supabase_storage import SupabaseStorageService
            return SupabaseStorageService.validate_storage_path(clean_path)

        parts = clean_path.split('/')
        category = parts[0] if parts else 'uploaded'
        filename = parts[-1] if len(parts) > 1 else clean_path

        sup_category = 'uploads' if category in ('uploaded', 'uploads') else ('processed' if category in ('processed',) else 'invoices')
        uid = user_id if (user_id is not None) else 0

        from accounts.services.supabase_storage import SupabaseStorageService
        return SupabaseStorageService.build_user_storage_path(sup_category, uid, filename)

    def store_file(self, file_obj_or_path, original_filename, category='uploaded', user_id=None):
        """
        Stores a file locally AND uploads to Supabase Storage (uploads/user_<ID>/, processed/user_<ID>/).
        Returns dict containing metadata (storage_path, stored_filename, checksum, file_size, file_type, supabase_path).
        """
        ext = os.path.splitext(original_filename)[1].lstrip('.').lower() or 'bin'
        stored_filename = f"{uuid.uuid4()}.{ext}"
        rel_path = f"{category}/{stored_filename}"
        target_abs_path = self.get_absolute_path(rel_path)
        target_abs_path.parent.mkdir(parents=True, exist_ok=True)

        checksum = None
        file_size = 0

        # Save locally for temporary processing and fallback
        if isinstance(file_obj_or_path, (str, Path)):
            src_path = Path(file_obj_or_path)
            checksum = self.calculate_checksum(src_path)
            file_size = src_path.stat().st_size
            shutil.copy2(src_path, target_abs_path)
        elif hasattr(file_obj_or_path, 'chunks'):
            sha256 = hashlib.sha256()
            with open(target_abs_path, 'wb') as dst:
                for chunk in file_obj_or_path.chunks():
                    dst.write(chunk)
                    sha256.update(chunk)
                    file_size += len(chunk)
            checksum = sha256.hexdigest()
        elif hasattr(file_obj_or_path, 'read'):
            sha256 = hashlib.sha256()
            pos = file_obj_or_path.tell() if hasattr(file_obj_or_path, 'tell') else 0
            with open(target_abs_path, 'wb') as dst:
                while True:
                    chunk = file_obj_or_path.read(65536)
                    if not chunk:
                        break
                    dst.write(chunk)
                    sha256.update(chunk)
                    file_size += len(chunk)
            if hasattr(file_obj_or_path, 'seek'):
                file_obj_or_path.seek(pos)
            checksum = sha256.hexdigest()
        elif isinstance(file_obj_or_path, bytes):
            checksum = hashlib.sha256(file_obj_or_path).hexdigest()
            file_size = len(file_obj_or_path)
            with open(target_abs_path, 'wb') as dst:
                dst.write(file_obj_or_path)

        # Upload to Supabase Storage if configured, otherwise rely on local storage
        supabase_path = None
        if self.supabase_service:
            try:
                supabase_path = self.get_supabase_storage_path(rel_path, user_id=user_id)
                with open(target_abs_path, 'rb') as f:
                    content_type = 'application/pdf' if ext == 'pdf' else None
                    self.supabase_service.upload_file(f.read(), supabase_path, content_type=content_type, upsert=True)
                
                # Remote object existence verification
                if not self.supabase_service.file_exists(supabase_path):
                    logger.warning(f"Remote Supabase object verification notice for '{supabase_path}'. Retaining local copy.")
            except Exception as e:
                logger.warning(f"Supabase Storage upload notice for '{rel_path}': {e}. Using local disk storage.")
                supabase_path = None

        return {
            'storage_path': supabase_path or rel_path,
            'stored_filename': os.path.basename(supabase_path) if supabase_path else stored_filename,
            'checksum': checksum,
            'file_size': file_size,
            'file_type': ext,
            'absolute_path': str(target_abs_path),
            'supabase_path': supabase_path
        }

    def get_file_bytes(self, relative_storage_path, user_id=None) -> bytes:
        """
        Retrieves file bytes. Attempts download from Supabase Storage first, then falls back to local disk.
        """
        if self.supabase_service:
            try:
                sup_path = self.get_supabase_storage_path(relative_storage_path, user_id=user_id)
                if self.supabase_service.file_exists(sup_path):
                    return self.supabase_service.download_file(sup_path)
                elif self.supabase_service.file_exists(str(relative_storage_path).replace('\\', '/').lstrip('/')):
                    return self.supabase_service.download_file(str(relative_storage_path).replace('\\', '/').lstrip('/'))
            except Exception as e:
                logger.warning(f"Supabase Storage download fallback to local disk for '{relative_storage_path}': {e}")

        # Local Fallback
        abs_path = self.get_absolute_path(relative_storage_path)
        if not abs_path.exists():
            raise FileNotFoundError(f"File not found in local or remote storage: {relative_storage_path}")
        with open(abs_path, 'rb') as f:
            return f.read()

    def get_signed_url(self, relative_storage_path, user_id=None, expires_in=300) -> str:
        """
        Generates a temporary signed URL from Supabase Storage.
        """
        if self.supabase_service:
            sup_path = self.get_supabase_storage_path(relative_storage_path, user_id=user_id)
            return self.supabase_service.create_signed_url(sup_path, expires_in=expires_in)
        raise ValueError("Supabase Storage Service unavailable for signed URL generation.")

    def delete_file(self, relative_storage_path, user_id=None):
        if not relative_storage_path:
            return False
        deleted_remote = False
        deleted_local = False

        # 1. Delete from Supabase Storage
        if self.supabase_service:
            try:
                sup_path = self.get_supabase_storage_path(relative_storage_path, user_id=user_id)
                deleted_remote = self.supabase_service.delete_file(sup_path)
            except Exception as e:
                logger.warning(f"Supabase Storage delete warning for '{relative_storage_path}': {e}")

        # 2. Delete from Local Disk
        try:
            abs_path = self.get_absolute_path(relative_storage_path)
            if abs_path.exists():
                abs_path.unlink()
                deleted_local = True
        except Exception as e:
            logger.warning(f"Local disk delete warning for '{relative_storage_path}': {e}")

        return deleted_remote or deleted_local


    def get_storage_stats(self):
        """
        Calculates total disk space used, file counts, breakdown by uploaded/processed.
        """
        total_size = 0
        total_files = 0
        uploaded_size = 0
        uploaded_files = 0
        processed_size = 0
        processed_files = 0

        for root, dirs, files in os.walk(self.base_dir):
            for f in files:
                fp = Path(root) / f
                if fp.is_file():
                    sz = fp.stat().st_size
                    total_size += sz
                    total_files += 1
                    rel = str(fp.relative_to(self.base_dir)).replace('\\', '/')
                    if rel.startswith('uploaded'):
                        uploaded_size += sz
                        uploaded_files += 1
                    elif rel.startswith('processed'):
                        processed_size += sz
                        processed_files += 1

        def format_bytes(bytes_num):
            for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                if bytes_num < 1024.0:
                    return f"{bytes_num:.2f} {unit}"
                bytes_num /= 1024.0
            return f"{bytes_num:.2f} PB"

        return {
            'total_bytes': total_size,
            'total_formatted': format_bytes(total_size),
            'total_files': total_files,
            'uploaded_bytes': uploaded_size,
            'uploaded_formatted': format_bytes(uploaded_size),
            'uploaded_files': uploaded_files,
            'processed_bytes': processed_size,
            'processed_formatted': format_bytes(processed_size),
            'processed_files': processed_files,
            'storage_directory': str(self.base_dir.resolve())
        }
