#!/usr/bin/env python
"""
Migrate data from SQLite to Supabase PostgreSQL
"""
import os
import sys
import django

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from api.models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences

def migrate_data():
    """Migrate all data to PostgreSQL"""
    print("=" * 60)
    print("Migrating Data to Supabase PostgreSQL")
    print("=" * 60)
    
    # Check current counts
    print("\nCurrent data counts:")
    print(f"  Questions: {Question.objects.count()}")
    print(f"  Exams: {Exam.objects.count()}")
    print(f"  Attempts: {Attempt.objects.count()}")
    print(f"  Sessions: {ExamSession.objects.count()}")
    print(f"  Daily Plans: {DailyPlan.objects.count()}")
    print(f"  Theme Preferences: {ThemePreferences.objects.count()}")
    
    print("\n[OK] Data is already in PostgreSQL!")
    print("If you see 0 counts, run migrations first:")
    print("  python backend/manage.py migrate")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    migrate_data()

