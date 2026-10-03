from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import (
    Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences, SubjectPriority, ExamImport,
    StudyDoc, StudySession, StudyMessage,
)
from .study_docs import relevant_docs


class QuestionSerializer(serializers.ModelSerializer):
    # Question ids are a global primary key shared by all users, so they are
    # always generated server-side; client-supplied ids are ignored.
    questionId = serializers.CharField(source='question_id', read_only=True)
    correctAnswer = serializers.CharField(source='correct_answer')
    
    class Meta:
        model = Question
        fields = ['questionId', 'question', 'choices', 'correctAnswer', 'subject', 'topic', 'explanation']
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['questionId'] = instance.question_id
        data['correctAnswer'] = instance.correct_answer
        return data
    
    def create(self, validated_data):
        import uuid
        validated_data['question_id'] = f"q_{uuid.uuid4().hex[:16]}"
        return super().create(validated_data)


class ExamSerializer(serializers.ModelSerializer):
    examId = serializers.CharField(source='exam_id', read_only=True)
    questionIds = serializers.ListField(source='question_ids', child=serializers.CharField())
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Exam
        fields = ['examId', 'title', 'questionIds', 'createdAt']


class AttemptSerializer(serializers.ModelSerializer):
    attemptId = serializers.CharField(source='attempt_id', read_only=True)
    questionId = serializers.CharField(source='question_id')
    selectedAnswer = serializers.CharField(source='selected_answer')
    isCorrect = serializers.BooleanField(source='is_correct')
    timeSpent = serializers.IntegerField(source='time_spent')
    examId = serializers.CharField(source='exam_id', required=False, allow_blank=True, allow_null=True)
    planDateKey = serializers.CharField(source='plan_date_key', required=False, allow_blank=True, allow_null=True)
    sessionId = serializers.CharField(source='session_id', required=False, allow_null=True, max_length=255)
    
    class Meta:
        model = Attempt
        fields = ['attemptId', 'questionId', 'selectedAnswer', 'isCorrect', 'timeSpent', 
                  'subject', 'topic', 'examId', 'mode', 'planDateKey', 'sessionId', 'timestamp']
        read_only_fields = ['attemptId', 'timestamp']
    
    def create(self, validated_data):
        # Generate attempt_id if not provided
        import uuid
        attempt_id = f"attempt_{uuid.uuid4().hex[:16]}"
        validated_data['attempt_id'] = attempt_id
        return super().create(validated_data)


class ExamSessionSerializer(serializers.ModelSerializer):
    sessionId = serializers.CharField(source='session_id', read_only=True)
    examId = serializers.CharField(source='exam_id', required=False, allow_blank=True, allow_null=True)
    currentIndex = serializers.IntegerField(source='current_index')
    questionIds = serializers.ListField(source='question_ids', child=serializers.CharField())
    isComplete = serializers.BooleanField(source='is_complete')
    isPaused = serializers.BooleanField(source='is_paused')
    timeSpent = serializers.DictField(source='time_spent', child=serializers.IntegerField())
    timePerQuestion = serializers.IntegerField(source='time_per_question', required=False, allow_null=True)
    planDateKey = serializers.CharField(source='plan_date_key', required=False, allow_blank=True, allow_null=True)
    startedAt = serializers.DateTimeField(source='started_at', read_only=True)
    lastUpdated = serializers.DateTimeField(source='last_updated', read_only=True)
    
    class Meta:
        model = ExamSession
        fields = ['sessionId', 'examId', 'mode', 'config', 'currentIndex', 'questionIds', 
                  'answers', 'timeSpent', 'isComplete', 'isPaused', 'timePerQuestion', 
                  'planDateKey', 'startedAt', 'lastUpdated']
        read_only_fields = ['sessionId', 'startedAt', 'lastUpdated']
    
    def create(self, validated_data):
        # Generate session_id if not provided
        import uuid
        from datetime import datetime
        session_id = f"session_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:9]}"
        validated_data['session_id'] = session_id
        return super().create(validated_data)


class DailyPlanSerializer(serializers.ModelSerializer):
    dateKey = serializers.CharField(source='date_key')
    focusSubject = serializers.CharField(source='focus_subject')
    totalAvailableInSubject = serializers.IntegerField(source='total_available_in_subject')
    maxPlannedQuestions = serializers.IntegerField(source='max_planned_questions')
    questionIds = serializers.ListField(source='question_ids', child=serializers.CharField())
    answeredCount = serializers.IntegerField(source='answered_count')
    correctCount = serializers.IntegerField(source='correct_count')
    wrongCount = serializers.IntegerField(source='wrong_count')
    isComplete = serializers.BooleanField(source='is_complete')
    motivationalQuote = serializers.CharField(source='motivational_quote', required=False, allow_blank=True, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    lastUpdated = serializers.DateTimeField(source='last_updated', read_only=True)
    
    class Meta:
        model = DailyPlan
        fields = ['dateKey', 'focusSubject', 'totalAvailableInSubject', 'maxPlannedQuestions', 
                  'questionIds', 'answeredCount', 'correctCount', 'wrongCount', 'accuracy', 
                  'isComplete', 'motivationalQuote', 'createdAt', 'lastUpdated']
        read_only_fields = ['dateKey', 'createdAt', 'lastUpdated']


class ThemePreferencesSerializer(serializers.ModelSerializer):
    favoriteLightTheme = serializers.CharField(source='favorite_light_theme')
    favoriteDarkTheme = serializers.CharField(source='favorite_dark_theme')
    autoMode = serializers.BooleanField(source='auto_mode')
    
    class Meta:
        model = ThemePreferences
        fields = ['favoriteLightTheme', 'favoriteDarkTheme', 'autoMode']


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate_username(self, value):
        value = value.strip()
        try:
            get_user_model().username_validator(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('That username is already taken.')
        return value

    def validate(self, attrs):
        user = get_user_model()(username=attrs['username'], email=attrs.get('email', ''))
        try:
            validate_password(attrs['password'], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return get_user_model().objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)


class SubjectPrioritySerializer(serializers.ModelSerializer):
    priorityOrder = serializers.IntegerField(source='priority_order')
    isCompleted = serializers.BooleanField(source='is_completed')
    roundNumber = serializers.IntegerField(source='round_number', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    lastUpdated = serializers.DateTimeField(source='last_updated', read_only=True)
    
    class Meta:
        model = SubjectPriority
        fields = ['subject', 'priorityOrder', 'isCompleted', 'roundNumber', 'createdAt', 'lastUpdated']



class ExamImportSerializer(serializers.ModelSerializer):
    originalFilename = serializers.CharField(source='original_filename', read_only=True)
    pageCount = serializers.IntegerField(source='page_count', read_only=True)
    pagesProcessed = serializers.IntegerField(source='pages_processed', read_only=True)
    pagesPerBatch = serializers.SerializerMethodField()
    questions = serializers.JSONField(source='draft_questions', read_only=True)
    examId = serializers.CharField(source='exam_id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = ExamImport
        fields = ['id', 'originalFilename', 'title', 'status', 'error', 'pageCount', 'pagesProcessed',
                  'pagesPerBatch', 'questions', 'examId', 'createdAt', 'updatedAt']
        read_only_fields = fields

    def get_pagesPerBatch(self, obj):
        return max(1, settings.EXAM_IMPORT_PAGES_PER_BATCH)


class StudyDocSerializer(serializers.ModelSerializer):
    originalFilename = serializers.CharField(source='original_filename', read_only=True)
    keyPoints = serializers.JSONField(source='key_points', read_only=True)
    pageCount = serializers.IntegerField(source='page_count', read_only=True)
    fileAvailable = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = StudyDoc
        fields = ['id', 'originalFilename', 'title', 'description', 'subject', 'topics', 'keyPoints',
                  'pageCount', 'status', 'error', 'fileAvailable', 'createdAt', 'updatedAt']
        read_only_fields = fields

    def get_fileAvailable(self, obj):
        return bool(obj.file) and obj.file.storage.exists(obj.file.name)


class StudyMessageSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = StudyMessage
        fields = ['id', 'role', 'content', 'createdAt']
        read_only_fields = fields


class StudySessionSerializer(serializers.ModelSerializer):
    planDateKey = serializers.CharField(source='plan_date_key', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = StudySession
        fields = ['id', 'title', 'subject', 'topics', 'planDateKey', 'status', 'error', 'createdAt', 'updatedAt']
        read_only_fields = fields


class StudySessionDetailSerializer(StudySessionSerializer):
    messages = StudyMessageSerializer(many=True, read_only=True)
    materials = serializers.SerializerMethodField()

    class Meta(StudySessionSerializer.Meta):
        fields = StudySessionSerializer.Meta.fields + ['messages', 'materials']
        read_only_fields = fields

    def get_materials(self, obj):
        return [
            {'id': doc.id, 'title': doc.title or doc.original_filename}
            for doc in relevant_docs(obj.owner, obj.subject, obj.topics)
        ]
