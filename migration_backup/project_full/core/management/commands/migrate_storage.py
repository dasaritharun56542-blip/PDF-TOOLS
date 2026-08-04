import os
import shutil
import hashlib
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from core.models import UploadedFile, ProcessedFile
from core.secure_storage import SecureStorageManager

class Command(BaseCommand):
    help = 'Migrates all existing uploaded and processed files from the application directory to Enterprise Secure Admin Storage outside the workspace.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting Enterprise Secure File Storage Migration..."))
        storage_mgr = SecureStorageManager()
        app_media_dir = (settings.BASE_DIR / 'media').resolve()

        migrated_uploaded = 0
        migrated_processed = 0
        migrated_bytes = 0

        # 1. Migrate UploadedFile records
        uploaded_qs = UploadedFile.objects.all()
        self.stdout.write(f"Scanning {uploaded_qs.count()} UploadedFile database records...")
        for uf in uploaded_qs:
            file_path = None
            if uf.storage_path:
                candidate = storage_mgr.get_absolute_path(uf.storage_path)
                if candidate.exists():
                    file_path = candidate
            if not file_path and uf.file:
                old_path = Path(str(uf.file))
                if not old_path.is_absolute():
                    old_path = (settings.BASE_DIR / old_path).resolve()
                if old_path.exists():
                    file_path = old_path

            if file_path and file_path.exists():
                meta = storage_mgr.store_file(file_path, uf.filename, category='uploaded')
                uf.stored_filename = meta['stored_filename']
                uf.storage_path = meta['storage_path']
                uf.checksum = meta['checksum']
                uf.file_type = meta['file_type']
                uf.size = meta['file_size']
                uf.file.name = meta['storage_path']
                uf.save()
                migrated_uploaded += 1
                migrated_bytes += meta['file_size']

                # Remove original if it was inside app_media_dir
                if str(file_path.resolve()).startswith(str(app_media_dir)) and file_path != Path(meta['absolute_path']):
                    try:
                        file_path.unlink()
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Could not remove old file {file_path}: {e}"))

        # 2. Migrate ProcessedFile records
        processed_qs = ProcessedFile.objects.all()
        self.stdout.write(f"Scanning {processed_qs.count()} ProcessedFile database records...")
        for pf in processed_qs:
            file_path = None
            if pf.storage_path:
                candidate = storage_mgr.get_absolute_path(pf.storage_path)
                if candidate.exists():
                    file_path = candidate
            if not file_path and pf.file:
                old_path = Path(str(pf.file.name))
                if not old_path.is_absolute():
                    # check if in app_media_dir
                    candidate1 = app_media_dir / old_path
                    candidate2 = settings.BASE_DIR / old_path
                    candidate3 = app_media_dir / 'processed' / os.path.basename(str(old_path))
                    if candidate1.exists():
                        file_path = candidate1
                    elif candidate2.exists():
                        file_path = candidate2
                    elif candidate3.exists():
                        file_path = candidate3

                if file_path and file_path.exists():
                    meta = storage_mgr.store_file(file_path, pf.filename, category='processed')
                    pf.stored_filename = meta['stored_filename']
                    pf.storage_path = meta['storage_path']
                    pf.checksum = meta['checksum']
                    pf.file_type = meta['file_type']
                    pf.file_size = meta['file_size']
                    pf.file.name = meta['storage_path']
                    pf.save()
                    migrated_processed += 1
                    migrated_bytes += meta['file_size']

                    # Remove original if it was inside app_media_dir
                    if str(file_path.resolve()).startswith(str(app_media_dir)) and file_path != Path(meta['absolute_path']):
                        try:
                            file_path.unlink()
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f"Could not remove old file {file_path}: {e}"))

        # 3. Sweep any unreferenced orphan files inside app_media_dir
        if app_media_dir.exists():
            self.stdout.write("Sweeping remaining files in application media directory...")
            for root, dirs, files in os.walk(app_media_dir, topdown=False):
                for fname in files:
                    full_p = Path(root) / fname
                    if full_p.is_file():
                        category = 'processed' if 'processed' in str(full_p).lower() else 'uploaded'
                        meta = storage_mgr.store_file(full_p, fname, category=category)
                        migrated_bytes += meta['file_size']
                        try:
                            full_p.unlink()
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f"Could not remove orphan file {full_p}: {e}"))
                for dname in dirs:
                    d_p = Path(root) / dname
                    try:
                        d_p.rmdir()
                    except Exception:
                        pass
            try:
                app_media_dir.rmdir()
            except Exception:
                pass

        # 4. Final verification
        remaining_files = []
        if app_media_dir.exists():
            for root, dirs, files in os.walk(app_media_dir):
                for f in files:
                    remaining_files.append(os.path.join(root, f))

        self.stdout.write(self.style.SUCCESS("=" * 70))
        self.stdout.write(self.style.SUCCESS("MIGRATION COMPLETED SUCCESSFULLY!"))
        self.stdout.write(self.style.SUCCESS(f"Migrated Uploaded Files: {migrated_uploaded}"))
        self.stdout.write(self.style.SUCCESS(f"Migrated Processed Files: {migrated_processed}"))
        self.stdout.write(self.style.SUCCESS(f"Total Bytes Migrated: {migrated_bytes} bytes"))
        self.stdout.write(self.style.SUCCESS(f"Secure Admin Storage Location: {storage_mgr.base_dir.resolve()}"))
        if remaining_files:
            self.stdout.write(self.style.ERROR(f"WARNING: {len(remaining_files)} remaining files in app media dir!"))
        else:
            self.stdout.write(self.style.SUCCESS("VERIFIED: Zero user files remain inside the application workspace directory."))
        self.stdout.write(self.style.SUCCESS("=" * 70))
