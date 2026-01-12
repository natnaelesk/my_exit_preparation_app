from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    QuestionViewSet, ExamViewSet, AttemptViewSet, 
    ExamSessionViewSet, DailyPlanViewSet, ThemePreferencesViewSet, AnalyticsViewSet, DebugViewSet
)

router = DefaultRouter()
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'exams', ExamViewSet, basename='exam')
router.register(r'attempts', AttemptViewSet, basename='attempt')
router.register(r'sessions', ExamSessionViewSet, basename='session')
router.register(r'plans', DailyPlanViewSet, basename='plan')
router.register(r'settings/theme', ThemePreferencesViewSet, basename='theme')
router.register(r'analytics', AnalyticsViewSet, basename='analytics')
router.register(r'debug', DebugViewSet, basename='debug')

urlpatterns = [
    path('', include(router.urls)),
]

