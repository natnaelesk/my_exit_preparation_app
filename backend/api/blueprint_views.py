import os

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from . import ai_client
from .blueprint_extraction import claim_for_extraction, clean_draft, mark_if_stale, start_extraction, validate_draft
from .curriculum import activate_blueprint, active_blueprint, active_course_names, apply_blueprint
from .models import BlueprintImport, UserBlueprint
from .pdf_pages import PdfReadError, read_upload
from .serializers import BlueprintImportSerializer, UserBlueprintDetailSerializer, UserBlueprintSerializer
from .views import OwnedQuerysetMixin


def _error(message, status_code, **extra):
    return Response({'error': message, **extra}, status=status_code)


class BlueprintImportViewSet(OwnedQuerysetMixin,
                             mixins.ListModelMixin,
                             mixins.RetrieveModelMixin,
                             mixins.DestroyModelMixin,
                             viewsets.GenericViewSet):
    """Upload an exit-exam blueprint PDF, extract the curriculum with AI, review it, then apply it."""
    queryset = BlueprintImport.objects.all()
    serializer_class = BlueprintImportSerializer
    parser_classes = [JSONParser, MultiPartParser]
    pagination_class = None

    def get_object(self):
        return mark_if_stale(super().get_object())

    def list(self, request):
        imports = [mark_if_stale(item) for item in self.get_queryset()]
        return Response(self.get_serializer(imports, many=True).data)

    def create(self, request):
        upload = request.FILES.get('file')
        try:
            data, page_count = read_upload(
                upload, settings.BLUEPRINT_IMPORT_MAX_UPLOAD_MB, settings.BLUEPRINT_IMPORT_MAX_PAGES,
            )
        except PdfReadError as exc:
            return _error(str(exc), status.HTTP_400_BAD_REQUEST)

        blueprint_import = BlueprintImport(
            owner=request.user,
            original_filename=os.path.basename(upload.name or 'blueprint.pdf')[:255],
            page_count=page_count,
        )
        blueprint_import.pdf.save('blueprint.pdf', ContentFile(data), save=True)
        return Response(self.get_serializer(blueprint_import).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        if instance.pdf:
            instance.pdf.delete(save=False)
        instance.delete()

    @action(detail=True, methods=['post'])
    def extract(self, request, pk=None):
        """Start (or resume after a failure) extracting the remaining pages. Poll GET for progress."""
        blueprint_import = self.get_object()
        if blueprint_import.status == BlueprintImport.STATUS_APPLIED:
            return _error('This blueprint was already applied.', status.HTTP_409_CONFLICT)
        if blueprint_import.status == BlueprintImport.STATUS_READY:
            return _error('All pages were already extracted.', status.HTTP_409_CONFLICT)
        if not ai_client.is_configured():
            return _error(
                'Blueprint import is not configured on the server yet (CURSOR_API_KEY).',
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not claim_for_extraction(blueprint_import):
            return _error('Extraction is already running for this PDF.', status.HTTP_409_CONFLICT)

        start_extraction(blueprint_import)
        blueprint_import.refresh_from_db()
        return Response(self.get_serializer(blueprint_import).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Save the reviewed curriculum into the user's blueprint history and make it the active one."""
        blueprint_import = self.get_object()
        if blueprint_import.status == BlueprintImport.STATUS_APPLIED:
            return _error('This blueprint was already applied.', status.HTTP_409_CONFLICT)
        if blueprint_import.status == BlueprintImport.STATUS_EXTRACTING:
            return _error('Wait for extraction to finish before applying.', status.HTTP_409_CONFLICT)

        draft = clean_draft(request.data)
        errors = validate_draft(draft)
        if errors:
            return _error(errors[0], status.HTTP_400_BAD_REQUEST, draftErrors=errors)

        with transaction.atomic():
            locked = BlueprintImport.objects.select_for_update().get(pk=blueprint_import.pk)
            if locked.status in (BlueprintImport.STATUS_APPLIED, BlueprintImport.STATUS_EXTRACTING):
                return _error('This import changed while applying; reload and try again.', status.HTTP_409_CONFLICT)
            blueprint = apply_blueprint(request.user, draft, source_import=locked, label=locked.original_filename)
            pdf_name, storage = locked.pdf.name, locked.pdf.storage
            if pdf_name:
                transaction.on_commit(lambda: storage.delete(pdf_name))
            locked.pdf = ''
            locked.draft = draft
            locked.status = BlueprintImport.STATUS_APPLIED
            locked.save(update_fields=['pdf', 'draft', 'status', 'updated_at'])

        return Response({
            'blueprint': UserBlueprintDetailSerializer(blueprint).data,
            'import': self.get_serializer(locked).data,
        }, status=status.HTTP_201_CREATED)


class UserBlueprintViewSet(OwnedQuerysetMixin,
                           mixins.ListModelMixin,
                           mixins.RetrieveModelMixin,
                           viewsets.GenericViewSet):
    """The user's applied blueprint history; exactly one entry can be active."""
    queryset = UserBlueprint.objects.all()
    serializer_class = UserBlueprintSerializer
    pagination_class = None

    def get_serializer_class(self):
        return UserBlueprintSerializer if self.action == 'list' else UserBlueprintDetailSerializer

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Make this history entry the active curriculum and rebuild subject priorities from its courses."""
        blueprint = activate_blueprint(request.user, self.get_object())
        return Response(UserBlueprintDetailSerializer(blueprint).data)


@api_view(['GET'])
def active_blueprint_view(request):
    """The user's active curriculum, or 404 when no blueprint has been applied yet."""
    blueprint = active_blueprint(request.user)
    if blueprint is None:
        return _error('No exit exam blueprint applied yet.', status.HTTP_404_NOT_FOUND)
    return Response(UserBlueprintDetailSerializer(blueprint).data)


@api_view(['GET'])
def subjects_view(request):
    """The active blueprint's course names (the user's only subject list); empty when none is applied."""
    return Response(active_course_names(request.user))
