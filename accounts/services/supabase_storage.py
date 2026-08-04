import os
import io
import re
import logging
from typing import Union, BinaryIO, Optional, Dict, Any

from supabase import create_client, Client

logger = logging.getLogger(__name__)

# ============================================================================
# CUSTOM EXCEPTIONS
# ============================================================================

class SupabaseStorageError(Exception):
    """Base exception for Supabase Storage Service."""
    pass


class SupabaseStorageConfigurationError(SupabaseStorageError):
    """Raised when environment configuration variables are missing or invalid."""
    pass


class SupabaseStorageNotFoundError(SupabaseStorageError):
    """Raised when a requested storage object is not found."""
    pass


class SupabaseStorageUploadError(SupabaseStorageError):
    """Raised when a file upload fails."""
    pass


class SupabaseStorageDownloadError(SupabaseStorageError):
    """Raised when a file download fails."""
    pass


# ============================================================================
# SUPABASE STORAGE SERVICE
# ============================================================================

class SupabaseStorageService:
    """
    Secure Django Server-Side Abstraction for Supabase Storage.
    
    Protects service role credentials and enforces strict user path scoping:
      - uploads/user_<USER_ID>/<filename>
      - processed/user_<USER_ID>/<filename>
      - invoices/user_<USER_ID>/<filename>
    """

    ALLOWED_CATEGORIES = {'uploads', 'processed', 'invoices'}

    def __init__(self):
        self.supabase_url = os.environ.get('SUPABASE_URL')
        self.service_role_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        self.bucket_name = os.environ.get('SUPABASE_STORAGE_BUCKET', 'pdf_powerhouse_media')

        if not self.supabase_url or not self.service_role_key or not self.bucket_name:
            missing = []
            if not self.supabase_url: missing.append('SUPABASE_URL')
            if not self.service_role_key: missing.append('SUPABASE_SERVICE_ROLE_KEY')
            if not self.bucket_name: missing.append('SUPABASE_STORAGE_BUCKET')
            raise SupabaseStorageConfigurationError(
                f"Missing required Supabase configuration: {', '.join(missing)}"
            )

        try:
            self.client: Client = create_client(self.supabase_url, self.service_role_key)
        except Exception as e:
            raise SupabaseStorageConfigurationError(
                f"Failed to initialize Supabase Storage client: {str(e)}"
            )

    @property
    def storage(self):
        return self.client.storage.from_(self.bucket_name)

    # ------------------------------------------------------------------------
    # PATH VALIDATION & HELPERS
    # ------------------------------------------------------------------------

    @staticmethod
    def validate_storage_path(storage_path: str) -> str:
        """
        Validates and normalizes storage path to prevent directory traversal.
        Disallows '..', drive letters (C:), UNC paths (\\\\), and leading slashes.
        """
        if not storage_path or not isinstance(storage_path, str):
            raise SupabaseStorageError("Storage path must be a non-empty string.")

        clean_path = storage_path.strip().replace('\\', '/')

        # Prohibit path traversal patterns
        if '..' in clean_path.split('/'):
            raise SupabaseStorageError(f"Path traversal ('..') detected in storage path: {storage_path}")

        if re.match(r'^[a-zA-Z]:', clean_path) or clean_path.startswith('//') or clean_path.startswith('\\\\'):
            raise SupabaseStorageError(f"Absolute filesystem or UNC paths are disallowed: {storage_path}")

        # Strip leading slash
        clean_path = clean_path.lstrip('/')
        if not clean_path:
            raise SupabaseStorageError("Storage path resolved to an empty string.")

        return clean_path

    @classmethod
    def build_user_storage_path(cls, category: str, user_id: Union[int, str], filename: str) -> str:
        """
        Constructs a safe, validated user storage path.
        Example: uploads/user_32/document.pdf
        """
        if category not in cls.ALLOWED_CATEGORIES:
            raise SupabaseStorageError(
                f"Invalid storage category '{category}'. Allowed: {', '.join(cls.ALLOWED_CATEGORIES)}"
            )

        if user_id is None:
            raise SupabaseStorageError("User ID must be provided for user storage paths.")

        clean_filename = os.path.basename(filename.strip().replace('\\', '/'))
        if not clean_filename or clean_filename in ('.', '..'):
            raise SupabaseStorageError("Invalid filename provided for storage path.")

        raw_path = f"{category}/user_{user_id}/{clean_filename}"
        return cls.validate_storage_path(raw_path)

    # ------------------------------------------------------------------------
    # STORAGE OPERATIONS
    # ------------------------------------------------------------------------

    def upload_file(
        self,
        file_data: Union[bytes, BinaryIO, str],
        storage_path: str,
        content_type: Optional[str] = None,
        upsert: bool = False
    ) -> Dict[str, Any]:
        """
        Uploads a file (bytes, file-like object, or local file path) to Supabase Storage.
        """
        clean_path = self.validate_storage_path(storage_path)

        # Convert input to bytes
        if isinstance(file_data, str):
            if not os.path.isfile(file_data):
                raise SupabaseStorageUploadError(f"Local file not found for upload: {file_data}")
            with open(file_data, 'rb') as f:
                content_bytes = f.read()
        elif isinstance(file_data, bytes):
            content_bytes = file_data
        elif hasattr(file_data, 'read'):
            content_bytes = file_data.read()
            if hasattr(file_data, 'seek'):
                file_data.seek(0)
        else:
            raise SupabaseStorageUploadError("Unsupported file_data type. Must be bytes, file-like object, or file path.")

        file_options = {}
        if content_type:
            file_options["content-type"] = content_type
        if upsert:
            file_options["upsert"] = "true"

        try:
            res = self.storage.upload(path=clean_path, file=content_bytes, file_options=file_options if file_options else None)
            logger.info(f"Successfully uploaded file to Supabase Storage: {clean_path}")
            return {
                "storage_path": clean_path,
                "bucket": self.bucket_name,
                "response": res
            }
        except Exception as e:
            err_msg = str(e)
            logger.error(f"Supabase Storage Upload Error for '{clean_path}': {err_msg}")
            raise SupabaseStorageUploadError(f"Failed to upload '{clean_path}': {err_msg}") from e

    def download_file(self, storage_path: str) -> bytes:
        """
        Downloads a private file from Supabase Storage and returns its raw bytes.
        """
        clean_path = self.validate_storage_path(storage_path)

        try:
            res_bytes = self.storage.download(clean_path)
            if res_bytes is None:
                raise SupabaseStorageNotFoundError(f"File not found in Supabase Storage: {clean_path}")
            return res_bytes
        except SupabaseStorageNotFoundError:
            raise
        except Exception as e:
            err_str = str(e)
            if "not found" in err_str.lower() or "404" in err_str:
                raise SupabaseStorageNotFoundError(f"File not found in Supabase Storage: {clean_path}") from e
            logger.error(f"Supabase Storage Download Error for '{clean_path}': {err_str}")
            raise SupabaseStorageDownloadError(f"Failed to download '{clean_path}': {err_str}") from e

    def delete_file(self, storage_path: str) -> bool:
        """
        Deletes a single storage object from Supabase Storage.
        """
        clean_path = self.validate_storage_path(storage_path)

        try:
            self.storage.remove([clean_path])
            logger.info(f"Successfully deleted object from Supabase Storage: {clean_path}")
            return True
        except Exception as e:
            err_str = str(e)
            logger.error(f"Supabase Storage Delete Error for '{clean_path}': {err_str}")
            raise SupabaseStorageError(f"Failed to delete '{clean_path}': {err_str}") from e

    def create_signed_url(self, storage_path: str, expires_in: int = 300) -> str:
        """
        Generates a temporary signed URL for private access to a file.
        Default expiration: 300 seconds (5 minutes).
        """
        clean_path = self.validate_storage_path(storage_path)

        if not isinstance(expires_in, int) or expires_in <= 0:
            raise SupabaseStorageError("expires_in must be a positive integer.")

        try:
            res = self.storage.create_signed_url(clean_path, expires_in)
            if isinstance(res, dict) and 'signedURL' in res:
                return res['signedURL']
            elif isinstance(res, dict) and 'signedUrl' in res:
                return res['signedUrl']
            elif hasattr(res, 'signed_url') and res.signed_url:
                return res.signed_url
            elif isinstance(res, str):
                return res
            else:
                # Handle dictionary or object return from storage3
                signed_url = str(res)
                return signed_url
        except Exception as e:
            err_str = str(e)
            logger.error(f"Supabase Storage Signed URL Error for '{clean_path}': {err_str}")
            raise SupabaseStorageError(f"Failed to create signed URL for '{clean_path}': {err_str}") from e

    def file_exists(self, storage_path: str) -> bool:
        """
        Checks whether a file exists in Supabase Storage without raising exceptions on missing files.
        """
        clean_path = self.validate_storage_path(storage_path)
        folder, filename = os.path.split(clean_path)

        try:
            items = self.storage.list(folder if folder else None)
            if isinstance(items, list):
                for item in items:
                    name = item.get('name') if isinstance(item, dict) else getattr(item, 'name', None)
                    if name == filename:
                        return True
            return False
        except Exception as e:
            # Fallback to download attempt if list is restricted
            try:
                self.download_file(clean_path)
                return True
            except SupabaseStorageNotFoundError:
                return False
            except Exception as inner_e:
                err_str = str(inner_e)
                logger.error(f"Error checking file_exists for '{clean_path}': {err_str}")
                raise SupabaseStorageError(f"Error checking existence of '{clean_path}': {err_str}") from inner_e
