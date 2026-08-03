from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import RenderedDocument
from .tasks import run_office_to_pdf_engine

class DocumentUploadAPIView(APIView):
    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "Missing file payload"}, status=status.HTTP_400_BAD_REQUEST)
        
        doc = RenderedDocument.objects.create(original_file=file)
        run_office_to_pdf_engine.delay(doc.id)
        
        return Response({
            "id": doc.id,
            "status": doc.status,
            "message": "Engine executing processing sequence async."
        }, status=status.HTTP_202_ACCEPTED)

class DocumentStatusAPIView(APIView):
    def get(self, request, pk):
        try:
            doc = RenderedDocument.objects.get(id=pk)
            return Response({
                "id": doc.id,
                "status": doc.status,
                "pdf_url": request.build_absolute_uri(doc.pdf_output.url) if doc.pdf_output else None
            }, status=status.HTTP_200_OK)
        except RenderedDocument.DoesNotExist:
            return Response({"error": "Not Found"}, status=status.HTTP_404_NOT_FOUND)
