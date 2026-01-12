from django.contrib import admin
from .models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('question_id', 'subject', 'topic', 'correct_answer')
    list_filter = ('subject', 'topic')
    search_fields = ('question_id', 'question', 'subject', 'topic')
    readonly_fields = ('question_id',)


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ('exam_id', 'title', 'created_at')
    search_fields = ('exam_id', 'title')
    readonly_fields = ('exam_id', 'created_at')


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ('attempt_id', 'question_id', 'subject', 'is_correct', 'timestamp')
    list_filter = ('is_correct', 'subject', 'mode', 'timestamp')
    search_fields = ('attempt_id', 'question_id', 'subject')
    readonly_fields = ('attempt_id', 'timestamp')


@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    list_display = ('session_id', 'mode', 'is_complete', 'is_paused', 'started_at')
    list_filter = ('mode', 'is_complete', 'is_paused', 'started_at')
    search_fields = ('session_id', 'exam_id')
    readonly_fields = ('session_id', 'started_at', 'last_updated')


@admin.register(DailyPlan)
class DailyPlanAdmin(admin.ModelAdmin):
    list_display = ('date_key', 'focus_subject', 'answered_count', 'accuracy', 'is_complete')
    list_filter = ('is_complete', 'focus_subject', 'date_key')
    search_fields = ('date_key', 'focus_subject')
    readonly_fields = ('date_key', 'created_at', 'last_updated')


@admin.register(ThemePreferences)
class ThemePreferencesAdmin(admin.ModelAdmin):
    list_display = ('id', 'favorite_light_theme', 'favorite_dark_theme', 'auto_mode')

