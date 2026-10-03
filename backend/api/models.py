from django.conf import settings
from django.db import models
import json
import uuid


class Question(models.Model):
    """Question model for storing exam questions"""
    question_id = models.CharField(max_length=255, primary_key=True, db_column='questionId')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='questions')
    question = models.TextField()
    choices = models.JSONField(default=list)
    correct_answer = models.CharField(max_length=255, db_column='correctAnswer')
    subject = models.CharField(max_length=255)
    topic = models.CharField(max_length=255, blank=True, null=True)
    explanation = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'questions'
        ordering = ['subject', 'topic']
    
    def __str__(self):
        return f"{self.question_id}: {self.subject} - {self.topic or 'No topic'}"


class Exam(models.Model):
    """Exam model for storing exam metadata"""
    exam_id = models.CharField(max_length=255, primary_key=True, db_column='examId')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='exams')
    title = models.CharField(max_length=255)
    question_ids = models.JSONField(default=list, db_column='questionIds')
    created_at = models.DateTimeField(auto_now_add=True, db_column='createdAt')
    
    class Meta:
        db_table = 'exams'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.exam_id}: {self.title}"


class Attempt(models.Model):
    """Attempt model for storing user answer attempts"""
    attempt_id = models.CharField(max_length=255, primary_key=True, db_column='attemptId')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attempts')
    question_id = models.CharField(max_length=255, db_column='questionId')
    selected_answer = models.CharField(max_length=255, db_column='selectedAnswer')
    is_correct = models.BooleanField(db_column='isCorrect')
    time_spent = models.IntegerField(default=0, db_column='timeSpent')  # in seconds
    subject = models.CharField(max_length=255)
    topic = models.CharField(max_length=255, blank=True, null=True)
    exam_id = models.CharField(max_length=255, blank=True, null=True, db_column='examId')
    mode = models.CharField(max_length=50, blank=True, null=True)
    plan_date_key = models.CharField(max_length=50, blank=True, null=True, db_column='planDateKey')
    # The exam session the answer belongs to; pause and finish both save attempts, so
    # an answer is stored once per session and question.
    session_id = models.CharField(max_length=255, blank=True, null=True, db_column='sessionId')
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'attempts'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['question_id']),
            models.Index(fields=['subject']),
            models.Index(fields=['subject', 'topic']),
            models.Index(fields=['plan_date_key']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'session_id', 'question_id'],
                condition=models.Q(session_id__isnull=False),
                name='unique_attempt_per_session_question',
            ),
        ]
    
    def __str__(self):
        return f"{self.attempt_id}: {self.question_id} - {'Correct' if self.is_correct else 'Wrong'}"


class ExamSession(models.Model):
    """ExamSession model for storing exam session state"""
    session_id = models.CharField(max_length=255, primary_key=True, db_column='sessionId')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='exam_sessions')
    exam_id = models.CharField(max_length=255, blank=True, null=True, db_column='examId')
    mode = models.CharField(max_length=50)
    config = models.JSONField(default=dict)
    current_index = models.IntegerField(default=0, db_column='currentIndex')
    question_ids = models.JSONField(default=list, db_column='questionIds')
    answers = models.JSONField(default=dict)
    time_spent = models.JSONField(default=dict, db_column='timeSpent')
    is_complete = models.BooleanField(default=False, db_column='isComplete')
    is_paused = models.BooleanField(default=False, db_column='isPaused')
    time_per_question = models.IntegerField(blank=True, null=True, db_column='timePerQuestion')
    plan_date_key = models.CharField(max_length=50, blank=True, null=True, db_column='planDateKey')
    started_at = models.DateTimeField(auto_now_add=True, db_column='startedAt')
    last_updated = models.DateTimeField(auto_now=True, db_column='lastUpdated')
    
    class Meta:
        db_table = 'examSessions'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['is_complete']),
            models.Index(fields=['plan_date_key']),
        ]
    
    def __str__(self):
        return f"{self.session_id}: {self.mode} - {'Complete' if self.is_complete else 'In Progress'}"


class DailyPlan(models.Model):
    """DailyPlan model for storing daily study plans (one per user per day)"""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='daily_plans')
    date_key = models.CharField(max_length=50, db_column='dateKey')
    focus_subject = models.CharField(max_length=255, db_column='focusSubject')
    total_available_in_subject = models.IntegerField(default=0, db_column='totalAvailableInSubject')
    max_planned_questions = models.IntegerField(default=35, db_column='maxPlannedQuestions')
    question_ids = models.JSONField(default=list, db_column='questionIds')
    answered_count = models.IntegerField(default=0, db_column='answeredCount')
    correct_count = models.IntegerField(default=0, db_column='correctCount')
    wrong_count = models.IntegerField(default=0, db_column='wrongCount')
    accuracy = models.FloatField(default=0.0)
    is_complete = models.BooleanField(default=False, db_column='isComplete')
    motivational_quote = models.TextField(blank=True, null=True, db_column='motivationalQuote')
    created_at = models.DateTimeField(auto_now_add=True, db_column='createdAt')
    last_updated = models.DateTimeField(auto_now=True, db_column='lastUpdated')
    
    class Meta:
        db_table = 'dailyPlans'
        ordering = ['-date_key']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'date_key'], name='unique_daily_plan_per_owner'),
        ]
    
    def __str__(self):
        return f"{self.date_key}: {self.focus_subject} - {self.answered_count}/{len(self.question_ids)}"


class ThemePreferences(models.Model):
    """ThemePreferences model for storing user theme settings"""
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='theme_preferences')
    favorite_light_theme = models.CharField(max_length=50, default='light', db_column='favoriteLightTheme')
    favorite_dark_theme = models.CharField(max_length=50, default='dark', db_column='favoriteDarkTheme')
    auto_mode = models.BooleanField(default=False, db_column='autoMode')
    
    class Meta:
        db_table = 'settings'
    
    def __str__(self):
        return f"Theme Preferences ({self.owner_id}): Auto={self.auto_mode}"


class FirebaseCollection(models.Model):
    """Generic model to store Firebase collections without specific models"""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='firebase_collections')
    collection_name = models.CharField(max_length=255, db_index=True)
    document_id = models.CharField(max_length=255, db_index=True)
    data = models.JSONField(default=dict)
    migrated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'firebase_collections'
        unique_together = [['owner', 'collection_name', 'document_id']]
        indexes = [
            models.Index(fields=['collection_name']),
        ]
    
    def __str__(self):
        return f"{self.collection_name}/{self.document_id}"


class SubjectPriority(models.Model):
    """SubjectPriority model for storing subject priority order and completion status"""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subject_priorities')
    subject = models.CharField(max_length=255)
    priority_order = models.IntegerField(default=0)  # Lower = higher priority
    is_completed = models.BooleanField(default=False)
    round_number = models.IntegerField(default=1)  # Track which round
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'subjectPriorities'
        ordering = ['priority_order', 'subject']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'subject'], name='unique_subject_priority_per_owner'),
        ]
    
    def __str__(self):
        return f"{self.subject}: Priority {self.priority_order}, Round {self.round_number}, {'Completed' if self.is_completed else 'Active'}"


def exam_import_upload_path(instance, filename):
    return f"exam_imports/{instance.owner_id}/{uuid.uuid4().hex}.pdf"


class ExamImport(models.Model):
    """An uploaded exam PDF and the AI-extracted draft questions awaiting review."""
    STATUS_PENDING = 'pending'          # uploaded, pages left to extract
    STATUS_EXTRACTING = 'extracting'    # a worker is extracting pages
    STATUS_READY = 'ready'              # all pages extracted, draft ready for review
    STATUS_FAILED = 'failed'            # last batch failed; extraction can be retried
    STATUS_PUBLISHED = 'published'      # draft saved as an Exam
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_EXTRACTING, 'Extracting'),
        (STATUS_READY, 'Ready for review'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_PUBLISHED, 'Published'),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='exam_imports')
    pdf = models.FileField(upload_to=exam_import_upload_path, blank=True)
    original_filename = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True)
    page_count = models.IntegerField(default=0)
    pages_processed = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error = models.TextField(blank=True)
    draft_questions = models.JSONField(default=list)
    exam_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'examImports'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.original_filename} ({self.status}, {self.pages_processed}/{self.page_count})"


def study_doc_upload_path(instance, filename):
    return f"study_docs/{instance.owner_id}/{uuid.uuid4().hex}.pdf"


class StudyDoc(models.Model):
    """A user's study material (PDF) plus an AI description that is kept in the DB for retrieval."""
    STATUS_DESCRIBING = 'describing'
    STATUS_READY = 'ready'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_DESCRIBING, 'Describing'),
        (STATUS_READY, 'Ready'),
        (STATUS_FAILED, 'Failed'),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='study_docs')
    file = models.FileField(upload_to=study_doc_upload_path, blank=True)
    original_filename = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=255, blank=True)
    topics = models.JSONField(default=list)
    key_points = models.JSONField(default=list)
    text_excerpt = models.TextField(blank=True)
    page_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DESCRIBING)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'studyDocs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title or self.original_filename} ({self.status})"


class StudySession(models.Model):
    """A tutor chat scoped to a daily plan or a subject/topic. One session per context per user."""
    STATUS_IDLE = 'idle'
    STATUS_THINKING = 'thinking'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_IDLE, 'Idle'),
        (STATUS_THINKING, 'Thinking'),
        (STATUS_FAILED, 'Failed'),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='study_sessions')
    context_key = models.CharField(max_length=512)
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, blank=True)
    topics = models.JSONField(default=list)
    plan_date_key = models.CharField(max_length=10, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IDLE)
    error = models.TextField(blank=True)
    # The Cursor cloud agent (bc-...) holding this chat's conversation; follow-up messages resume it.
    cursor_agent_id = models.CharField(max_length=128, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'studySessions'
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['owner', 'context_key'], name='unique_study_session_per_context'),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"


class StudyMessage(models.Model):
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistant'
    ROLE_CHOICES = [(ROLE_USER, 'User'), (ROLE_ASSISTANT, 'Assistant')]

    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'studyMessages'
        ordering = ['created_at', 'id']
