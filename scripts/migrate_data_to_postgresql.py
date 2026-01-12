#!/usr/bin/env python
"""
Migrate data from SQLite to PostgreSQL (Supabase)
"""
import os
import sys
import django

# First, connect to SQLite to read data
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

# Save PostgreSQL URL before switching to SQLite
postgres_url = os.environ.get('DATABASE_URL')

# Read from SQLite (no DATABASE_URL = uses SQLite)
if 'DATABASE_URL' in os.environ:
    del os.environ['DATABASE_URL']

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from api.models import (
    Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences
)

print("=" * 60)
print("Reading data from SQLite...")
print("=" * 60)

# Read all data from SQLite
sqlite_questions = list(Question.objects.all())
sqlite_exams = list(Exam.objects.all())
sqlite_attempts = list(Attempt.objects.all())
sqlite_sessions = list(ExamSession.objects.all())
sqlite_plans = list(DailyPlan.objects.all())
sqlite_theme = list(ThemePreferences.objects.all())

print(f"Found in SQLite:")
print(f"  Questions: {len(sqlite_questions)}")
print(f"  Exams: {len(sqlite_exams)}")
print(f"  Attempts: {len(sqlite_attempts)}")
print(f"  Sessions: {len(sqlite_sessions)}")
print(f"  Daily Plans: {len(sqlite_plans)}")
print(f"  Theme Preferences: {len(sqlite_theme)}")

# Now connect to PostgreSQL
print("\n" + "=" * 60)
print("Connecting to PostgreSQL (Supabase)...")
print("=" * 60)

# Use saved PostgreSQL URL
if not postgres_url:
    print("[ERROR] DATABASE_URL not set!")
    print("Please set it with your Supabase connection string")
    print('Example: $env:DATABASE_URL="postgresql://..."')
    sys.exit(1)

os.environ['DATABASE_URL'] = postgres_url

# Force Django to reload database config
import importlib
import django.conf
importlib.reload(django.conf.settings)

from django.conf import settings
from django.db import connections
connections.close_all()

# Force reload settings module
settings_module = importlib.import_module('exam_app.settings')
importlib.reload(settings_module)

# Update DATABASES directly
import dj_database_url
settings.DATABASES = {
    'default': dj_database_url.config(
        default=postgres_url,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Re-import models to use new database
from api.models import (
    Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences
)

# Write to PostgreSQL
print("\n" + "=" * 60)
print("Writing data to PostgreSQL...")
print("=" * 60)

def migrate_model(model_class, data_list, model_name):
    """Migrate a model's data"""
    print(f"\nMigrating {model_name}...")
    count = 0
    from django.db import transaction
    
    with transaction.atomic():
        for item in data_list:
            try:
                # Get all fields except the primary key
                data = {}
                for field in item._meta.fields:
                    if field.primary_key:
                        pk_value = getattr(item, field.name)
                        continue
                    value = getattr(item, field.name)
                    data[field.name] = value
                
                # Create new instance with same primary key
                pk_field = item._meta.pk.name
                pk_value = getattr(item, pk_field)
                
                model_class.objects.update_or_create(
                    **{pk_field: pk_value},
                    defaults=data
                )
                count += 1
                if count % 50 == 0:
                    print(f"  Migrated {count}/{len(data_list)} {model_name}...")
            except Exception as e:
                print(f"  [ERROR] Failed to migrate {model_name} {getattr(item, item._meta.pk.name)}: {e}")
                import traceback
                traceback.print_exc()
    
    print(f"[OK] Migrated {count} {model_name}")
    return count

total = 0
total += migrate_model(Question, sqlite_questions, "questions")
total += migrate_model(Exam, sqlite_exams, "exams")
total += migrate_model(Attempt, sqlite_attempts, "attempts")
total += migrate_model(ExamSession, sqlite_sessions, "sessions")
total += migrate_model(DailyPlan, sqlite_plans, "daily plans")
total += migrate_model(ThemePreferences, sqlite_theme, "theme preferences")

print("\n" + "=" * 60)
print(f"[SUCCESS] Migration complete! Total records: {total}")
print("=" * 60)

# Verify
print("\nVerifying data in PostgreSQL:")
print(f"  Questions: {Question.objects.count()}")
print(f"  Exams: {Exam.objects.count()}")
print(f"  Attempts: {Attempt.objects.count()}")
print(f"  Sessions: {ExamSession.objects.count()}")
print(f"  Daily Plans: {DailyPlan.objects.count()}")
print(f"  Theme Preferences: {ThemePreferences.objects.count()}")

