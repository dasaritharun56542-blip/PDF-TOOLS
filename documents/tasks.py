import os
import requests
import logging
from celery import shared_task
from django.core.files.base import ContentFile
from django.conf import settings
from .models import RenderedDocument

logger = logging.getLogger(__name__)

@shared_task
def run_office_to_pdf_engine(doc_id):
    try:
        doc = RenderedDocument.objects.get(id=doc_id)
        doc.status = 'PROCESSING'
        doc.save()

        file_path = doc.original_file.path
        filename = os.path.basename(file_path)

        # =====================================================================
        # Phase 10 Connection: Route async Celery tasks through the
        # production office_conversion.OfficeConversionManager subsystem.
        # =====================================================================
        from office_conversion import OfficeConversionManager
        manager = OfficeConversionManager()
        
        import tempfile, uuid
        temp_out_pdf = os.path.join(tempfile.gettempdir(), f"task_{uuid.uuid4()}.pdf")
        out_path, engine_used = manager.process(file_path, filename, temp_out_pdf)
        
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            pdf_name = f"{os.path.splitext(filename)[0]}.pdf"
            with open(out_path, 'rb') as f_pdf:
                doc.pdf_output.save(pdf_name, ContentFile(f_pdf.read()), save=False)
            doc.status = 'COMPLETED'
            doc.save()
            if os.path.exists(out_path):
                try: os.remove(out_path)
                except Exception: pass
        else:
            doc.status = 'FAILED'
            doc.save()
            
    except Exception as exc:
        logger.exception(f"Exception during office-to-pdf conversion for doc_id={doc_id}: {exc}")
        try:
            doc = RenderedDocument.objects.get(id=doc_id)
            doc.status = 'FAILED'
            doc.save()
        except Exception:
            pass
