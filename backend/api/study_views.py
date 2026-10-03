import os
import re

from django.conf import settings
from django.core.files.base import ContentFile
from django.http import FileResponse
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from . import ai_client, study_chat, study_docs
from .models import StudyDoc, StudyMessage, StudySession
from .pdf_pages import PdfReadError, extract_text, read_upload
from .serializers import StudyDocSerializer, StudySessionDetailSerializer, StudySessionSerializer
from .views import OwnedQuerysetMixin

DATE_KEY_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
NOT_CONFIGURED = 'The AI tutor is not configured on the server yet (AI_API_KEY / AI_MODEL).'


def _error(message, status_code):
    return Response({'error': message}, status=status_code)


class StudyDocViewSet(OwnedQuerysetMixin,
                      mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    """Private study PDFs. Each gets an AI description that Study chat uses for retrieval."""
    queryset = StudyDoc.objects.all()
    serializer_class = StudyDocSerializer
    parser_classes = [JSONParser, MultiPartParser]
    pagination_class = None

    def get_object(self):
        return study_docs.mark_if_stale(super().get_object())

    def list(self, request):
        docs = [study_docs.mark_if_stale(doc) for doc in self.get_queryset()]
        return Response(self.get_serializer(docs, many=True).data)

    def create(self, request):
        upload = request.FILES.get('file')
        try:
            data, page_count = read_upload(upload, settings.STUDY_DOC_MAX_UPLOAD_MB, settings.STUDY_DOC_MAX_PAGES)
            text_excerpt = extract_text(data, study_docs.EXCERPT_CHARS)
        except PdfReadError as exc:
            return _error(str(exc), status.HTTP_400_BAD_REQUEST)

        original_filename = os.path.basename(upload.name or 'study.pdf')[:255]
        configured = ai_client.is_configured()
        doc = StudyDoc(
            owner=request.user,
            original_filename=original_filename,
            title=str(request.data.get('title') or '').strip()[:255] or os.path.splitext(original_filename)[0][:255],
            page_count=page_count,
            text_excerpt=text_excerpt,
            status=StudyDoc.STATUS_DESCRIBING if configured else StudyDoc.STATUS_FAILED,
            error='' if configured else (
                'AI descriptions are not configured on the server (AI_API_KEY / AI_MODEL). '
                'The file is saved; retry once AI is set up.'
            ),
        )
        doc.file.save('study.pdf', ContentFile(data), save=True)
        if configured:
            study_docs.start_describe(doc)
            doc.refresh_from_db()
        return Response(self.get_serializer(doc).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        if instance.file:
            instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=['post'])
    def describe(self, request, pk=None):
        """Retry (or redo) the AI description. Poll GET for the result."""
        doc = self.get_object()
        if not ai_client.is_configured():
            return _error(NOT_CONFIGURED, status.HTTP_503_SERVICE_UNAVAILABLE)
        if not study_docs.claim_for_describe(doc):
            return _error('This PDF is already being described.', status.HTTP_409_CONFLICT)
        study_docs.start_describe(doc)
        doc.refresh_from_db()
        return Response(self.get_serializer(doc).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def file(self, request, pk=None):
        doc = self.get_object()
        if not doc.file or not doc.file.storage.exists(doc.file.name):
            return _error(
                'The PDF file is no longer stored on the server (storage was reset). '
                'Its description is still used by Study chat; upload it again to download.',
                status.HTTP_404_NOT_FOUND,
            )
        return FileResponse(
            doc.file.open('rb'), as_attachment=True, filename=doc.original_filename, content_type='application/pdf',
        )


class StudySessionViewSet(OwnedQuerysetMixin,
                          mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          mixins.DestroyModelMixin,
                          viewsets.GenericViewSet):
    """Persisted tutor chats, one per plan day or subject/topic."""
    queryset = StudySession.objects.all()
    serializer_class = StudySessionSerializer
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return StudySessionSerializer
        return StudySessionDetailSerializer

    def get_object(self):
        return study_chat.mark_if_stale(super().get_object())

    def create(self, request):
        """Open (or resume) the session for {planDateKey} or {subject, topic}."""
        plan_date_key = str(request.data.get('planDateKey') or '').strip()
        try:
            if plan_date_key:
                if not DATE_KEY_RE.match(plan_date_key):
                    return _error('planDateKey must look like YYYY-MM-DD.', status.HTTP_400_BAD_REQUEST)
                context = study_chat.plan_context(request.user, plan_date_key)
            else:
                context = study_chat.topic_context(request.data.get('subject'), request.data.get('topic'))
        except study_chat.SessionContextError as exc:
            return _error(str(exc), status.HTTP_400_BAD_REQUEST)

        session, created = study_chat.get_or_create_session(request.user, context)
        session = study_chat.mark_if_stale(session)
        return Response(
            StudySessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def messages(self, request, pk=None):
        """Send a message; the tutor replies in the background. Poll GET until status is not 'thinking'."""
        session = self.get_object()
        content = str(request.data.get('content') or '').strip()
        if not content:
            return _error('Type a message first.', status.HTTP_400_BAD_REQUEST)
        if len(content) > study_chat.MAX_MESSAGE_CHARS:
            return _error(
                f'Messages are limited to {study_chat.MAX_MESSAGE_CHARS} characters.', status.HTTP_400_BAD_REQUEST,
            )
        if not ai_client.is_configured():
            return _error(NOT_CONFIGURED, status.HTTP_503_SERVICE_UNAVAILABLE)
        if not study_chat.claim_for_reply(session):
            return _error('The tutor is still replying to your last message.', status.HTTP_409_CONFLICT)

        StudyMessage.objects.create(session=session, role=StudyMessage.ROLE_USER, content=content)
        study_chat.start_reply(session)
        session.refresh_from_db()
        return Response(self.get_serializer(session).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Regenerate the reply to the last user message after a failure."""
        session = self.get_object()
        last = session.messages.order_by('-created_at', '-id').first()
        if last is None or last.role != StudyMessage.ROLE_USER:
            return _error('There is no unanswered message to retry.', status.HTTP_409_CONFLICT)
        if not ai_client.is_configured():
            return _error(NOT_CONFIGURED, status.HTTP_503_SERVICE_UNAVAILABLE)
        if not study_chat.claim_for_reply(session):
            return _error('The tutor is still replying to your last message.', status.HTTP_409_CONFLICT)

        study_chat.start_reply(session)
        session.refresh_from_db()
        return Response(self.get_serializer(session).data, status=status.HTTP_202_ACCEPTED)
