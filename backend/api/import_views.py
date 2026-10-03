import os
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from . import ai_client
from .exam_extraction import claim_for_extraction, clean_submitted_question, mark_if_stale, start_extraction
from .models import Exam, ExamImport, Question
from .pdf_pages import PdfReadError, read_upload
from .serializers import ExamImportSerializer, ExamSerializer
from .views import OwnedQuerysetMixin

MAX_PUBLISH_QUESTIONS = 500


def _error(message, status_code, **extra):
    return Response({'error': message, **extra}, status=status_code)


class ExamImportViewSet(OwnedQuerysetMixin,
                        mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        mixins.DestroyModelMixin,
                        viewsets.GenericViewSet):
    """Upload an exam PDF, extract draft questions with AI, review, then publish as an Exam."""
    queryset = ExamImport.objects.all()
    serializer_class = ExamImportSerializer
    parser_classes = [JSONParser, MultiPartParser]

    def get_object(self):
        return mark_if_stale(super().get_object())

    def create(self, request):
        upload = request.FILES.get('file')
        try:
            data, page_count = read_upload(
                upload, settings.EXAM_IMPORT_MAX_UPLOAD_MB, settings.EXAM_IMPORT_MAX_PAGES,
            )
        except PdfReadError as exc:
            return _error(str(exc), status.HTTP_400_BAD_REQUEST)

        exam_import = ExamImport(
            owner=request.user,
            original_filename=os.path.basename(upload.name or 'exam.pdf')[:255],
            title=str(request.data.get('title', '')).strip()[:255],
            page_count=page_count,
        )
        exam_import.pdf.save('exam.pdf', ContentFile(data), save=True)
        return Response(self.get_serializer(exam_import).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        if instance.pdf:
            instance.pdf.delete(save=False)
        instance.delete()

    @action(detail=True, methods=['post'])
    def extract(self, request, pk=None):
        """Start (or resume after a failure) extracting the remaining pages. Poll GET for progress."""
        exam_import = self.get_object()
        if exam_import.status == ExamImport.STATUS_PUBLISHED:
            return _error('This import was already published.', status.HTTP_409_CONFLICT)
        if exam_import.status == ExamImport.STATUS_READY:
            return _error('All pages were already extracted.', status.HTTP_409_CONFLICT)
        if not ai_client.is_configured():
            return _error(
                'PDF import is not configured on the server yet (AI_API_KEY / AI_MODEL). Use JSON import for now.',
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not claim_for_extraction(exam_import):
            return _error('Extraction is already running for this PDF.', status.HTTP_409_CONFLICT)

        start_extraction(exam_import)
        exam_import.refresh_from_db()
        return Response(self.get_serializer(exam_import).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Save the reviewed questions as an Exam owned by the user. All-or-nothing."""
        exam_import = self.get_object()
        if exam_import.status == ExamImport.STATUS_PUBLISHED:
            return _error('This import was already published.', status.HTTP_409_CONFLICT)
        if exam_import.status == ExamImport.STATUS_EXTRACTING:
            return _error('Wait for extraction to finish before publishing.', status.HTTP_409_CONFLICT)

        title = str(request.data.get('title') or '').strip()
        raw_questions = request.data.get('questions')
        if not title:
            return _error('Give the exam a title.', status.HTTP_400_BAD_REQUEST)
        if len(title) > 255:
            return _error('The title is longer than 255 characters.', status.HTTP_400_BAD_REQUEST)
        if not isinstance(raw_questions, list) or not raw_questions:
            return _error('Add at least one question before publishing.', status.HTTP_400_BAD_REQUEST)
        if len(raw_questions) > MAX_PUBLISH_QUESTIONS:
            return _error(f'At most {MAX_PUBLISH_QUESTIONS} questions can be published at once.', status.HTTP_400_BAD_REQUEST)

        cleaned, question_errors = [], []
        for index, raw in enumerate(raw_questions):
            question, errors = clean_submitted_question(raw)
            if errors:
                question_errors.append({'index': index, 'errors': errors})
            cleaned.append(question)
        if question_errors:
            return _error(
                f'{len(question_errors)} question(s) need fixing before publishing.',
                status.HTTP_400_BAD_REQUEST,
                questionErrors=question_errors,
            )

        with transaction.atomic():
            locked = ExamImport.objects.select_for_update().get(pk=exam_import.pk)
            if locked.status in (ExamImport.STATUS_PUBLISHED, ExamImport.STATUS_EXTRACTING):
                return _error('This import changed while publishing; reload and try again.', status.HTTP_409_CONFLICT)

            questions = [
                Question(
                    question_id=f'q_{uuid.uuid4().hex[:16]}',
                    owner=request.user,
                    question=q['question'],
                    choices=q['choices'],
                    correct_answer=q['correctAnswer'],
                    subject=q['subject'],
                    topic=q['topic'] or 'General',
                    explanation=q['explanation'],
                )
                for q in cleaned
            ]
            Question.objects.bulk_create(questions)
            exam = Exam.objects.create(
                exam_id=f'exam_{uuid.uuid4().hex[:16]}',
                owner=request.user,
                title=title,
                question_ids=[q.question_id for q in questions],
            )
            # The PDF is only needed for extraction; drop it once the exam exists.
            pdf_name, storage = locked.pdf.name, locked.pdf.storage
            if pdf_name:
                transaction.on_commit(lambda: storage.delete(pdf_name))
            locked.pdf = ''
            locked.status = ExamImport.STATUS_PUBLISHED
            locked.exam_id = exam.exam_id
            locked.title = title
            locked.save(update_fields=['pdf', 'status', 'exam_id', 'title', 'updated_at'])

        return Response({
            'exam': ExamSerializer(exam).data,
            'import': self.get_serializer(locked).data,
        }, status=status.HTTP_201_CREATED)
