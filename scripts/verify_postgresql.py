#!/usr/bin/env python
"""Verify PostgreSQL data"""
import os
import sys
import django

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

postgres_url = os.environ.get('DATABASE_URL')
if not postgres_url:
    print("[ERROR] DATABASE_URL not set!")
    sys.exit(1)

os.environ['DATABASE_URL'] = postgres_url
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from api.models import Question, Attempt, Exam, ExamSession, DailyPlan, ThemePreferences

print("=" * 60)
print("Supabase PostgreSQL Verification")
print("=" * 60)
print(f"\nQuestions: {Question.objects.count()}")
print(f"Exams: {Exam.objects.count()}")
print(f"Attempts: {Attempt.objects.count()}")
print(f"Sessions: {ExamSession.objects.count()}")
print(f"Daily Plans: {DailyPlan.objects.count()}")
print(f"Theme Preferences: {ThemePreferences.objects.count()}")

total = (Question.objects.count() + Exam.objects.count() + 
         Attempt.objects.count() + ExamSession.objects.count() + 
         DailyPlan.objects.count() + ThemePreferences.objects.count())

print(f"\nTotal records: {total}")

# Sample data
if Question.objects.exists():
    q = Question.objects.first()
    print(f"\nSample question ID: {q.question_id}")
    print(f"Sample question subject: {q.subject}")

if Attempt.objects.exists():
    a = Attempt.objects.first()
    print(f"\nSample attempt ID: {a.attempt_id}")
    print(f"Sample attempt subject: {a.subject}")

print("\n" + "=" * 60)
print("[OK] Database is ready!")
print("=" * 60)

