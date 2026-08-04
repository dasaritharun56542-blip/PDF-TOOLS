import os
import hashlib
import uuid
import shutil
from pathlib import Path
from django.conf import settings

class SecureStorageManager:
    """
    Enterprise Secure Storage Manager.
    Enforces file storage outside the application directory, filename randomization,
    SHA256 checksum computation, file metadata management, and secure streaming.
    """
    def __init__(self):
        self.base_dir = Path(getattr(settings, 'SECURE_ADMIN_STORAGE_DIR', Path.home() / '.secure_admin_storage'))
        self.base_dir.mkdir(parents=True, exist_ok=True)
        (self.base_dir / 'uploaded').mkdir(parents=True, exist_ok=True)
        (self.base_dir / 'processed').mkdir(parents=True, exist_ok=True)

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

    def store_file(self, file_obj_or_path, original_filename, category='uploaded'):
        """
        Stores a file in secure admin storage with randomized filename.
        Returns dict containing metadata (storage_path, stored_filename, checksum, file_size, file_type).
        """
        ext = os.path.splitext(original_filename)[1].lstrip('.').lower() or 'bin'
        stored_filename = f"{uuid.uuid4()}.{ext}"
        rel_path = f"{category}/{stored_filename}"
        target_abs_path = self.get_absolute_path(rel_path)
        target_abs_path.parent.mkdir(parents=True, exist_ok=True)

        checksum = None
        file_size = 0

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

        return {
            'storage_path': rel_path,
            'stored_filename': stored_filename,
            'checksum': checksum,
            'file_size': file_size,
            'file_type': ext,
            'absolute_path': str(target_abs_path)
        }

    def delete_file(self, relative_storage_path):
        if not relative_storage_path:
            return False
        try:
            abs_path = self.get_absolute_path(relative_storage_path)
            if abs_path.exists():
                abs_path.unlink()
                return True
        except Exception as e:
            print(f"Error deleting file from secure storage: {e}")
        return False

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
