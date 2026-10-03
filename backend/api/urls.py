from django.urls import path, include
from rest_framework.permissions import AllowAny
from rest_framework.routers import APIRootView, DefaultRouter
from . import auth_views
from .import_views import ExamImportViewSet
from .study_views import StudyDocViewSet, StudySessionViewSet
from .views import (
    QuestionViewSet, ExamViewSet, AttemptViewSet, 
    ExamSessionViewSet, DailyPlanViewSet, ThemePreferencesView, AnalyticsViewSet, DebugViewSet,
    SubjectPriorityViewSet
)


class PublicAPIRootView(APIRootView):
    # Render's health check hits /api/ unauthenticated; the root only lists endpoint URLs.
    permission_classes = [AllowAny]


router = DefaultRouter()
router.APIRootView = PublicAPIRootView
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'exams', ExamViewSet, basename='exam')
router.register(r'exam-imports', ExamImportViewSet, basename='exam-import')
router.register(r'study-docs', StudyDocViewSet, basename='study-doc')
router.register(r'study-sessions', StudySessionViewSet, basename='study-session')
router.register(r'attempts', AttemptViewSet, basename='attempt')
router.register(r'sessions', ExamSessionViewSet, basename='session')
router.register(r'plans', DailyPlanViewSet, basename='plan')
router.register(r'subject-priorities', SubjectPriorityViewSet, basename='subject-priority')
router.register(r'analytics', AnalyticsViewSet, basename='analytics')
router.register(r'debug', DebugViewSet, basename='debug')

urlpatterns = [
    path('auth/signup/', auth_views.signup, name='auth-signup'),
    path('auth/login/', auth_views.login, name='auth-login'),
    path('auth/logout/', auth_views.logout, name='auth-logout'),
    path('auth/me/', auth_views.me, name='auth-me'),
    path('settings/theme/', ThemePreferencesView.as_view(), name='theme-preferences'),
    path('', include(router.urls)),
]
