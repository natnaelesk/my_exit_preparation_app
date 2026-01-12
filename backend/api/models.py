from django.db import models
import json


class Question(models.Model):
    """Question model for storing exam questions"""
    question_id = models.CharField(max_length=255, primary_key=True, db_column='questionId')
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
    question_id = models.CharField(max_length=255, db_column='questionId')
    selected_answer = models.CharField(max_length=255, db_column='selectedAnswer')
    is_correct = models.BooleanField(db_column='isCorrect')
    time_spent = models.IntegerField(default=0, db_column='timeSpent')  # in seconds
    subject = models.CharField(max_length=255)
    topic = models.CharField(max_length=255, blank=True, null=True)
    exam_id = models.CharField(max_length=255, blank=True, null=True, db_column='examId')
    mode = models.CharField(max_length=50, blank=True, null=True)
    plan_date_key = models.CharField(max_length=50, blank=True, null=True, db_column='planDateKey')
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
    
    def __str__(self):
        return f"{self.attempt_id}: {self.question_id} - {'Correct' if self.is_correct else 'Wrong'}"


class ExamSession(models.Model):
    """ExamSession model for storing exam session state"""
    session_id = models.CharField(max_length=255, primary_key=True, db_column='sessionId')
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
    """DailyPlan model for storing daily study plans"""
    date_key = models.CharField(max_length=50, primary_key=True, db_column='dateKey')
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
    
    def __str__(self):
        return f"{self.date_key}: {self.focus_subject} - {self.answered_count}/{len(self.question_ids)}"


class ThemePreferences(models.Model):
    """ThemePreferences model for storing user theme settings"""
    id = models.CharField(max_length=50, primary_key=True, default='themePreferences')
    favorite_light_theme = models.CharField(max_length=50, default='light', db_column='favoriteLightTheme')
    favorite_dark_theme = models.CharField(max_length=50, default='dark', db_column='favoriteDarkTheme')
    auto_mode = models.BooleanField(default=False, db_column='autoMode')
    
    class Meta:
        db_table = 'settings'
    
    def __str__(self):
        return f"Theme Preferences: Auto={self.auto_mode}"


class FirebaseCollection(models.Model):
    """Generic model to store Firebase collections without specific models"""
    collection_name = models.CharField(max_length=255, db_index=True)
    document_id = models.CharField(max_length=255, db_index=True)
    data = models.JSONField(default=dict)
    migrated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'firebase_collections'
        unique_together = [['collection_name', 'document_id']]
        indexes = [
            models.Index(fields=['collection_name']),
        ]
    
    def __str__(self):
        return f"{self.collection_name}/{self.document_id}"
