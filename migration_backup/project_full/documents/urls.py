from django.urls import path
from .views import DocumentUploadAPIView, DocumentStatusAPIView

urlpatterns = [
    path('upload/', DocumentUploadAPIView.as_view(), name='doc-upload'),
    path('status/<int:pk>/', DocumentStatusAPIView.as_view(), name='doc-status'),
]
