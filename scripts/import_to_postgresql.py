#!/usr/bin/env python
"""Import data from JSON to PostgreSQL"""
import os
import sys
import json
import django

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

# Must have DATABASE_URL set
postgres_url = os.environ.get('DATABASE_URL')
if not postgres_url:
    print("[ERROR] DATABASE_URL not set!")
    print("Set it with: $env:DATABASE_URL='postgresql://...'")
    sys.exit(1)

os.environ['DATABASE_URL'] = postgres_url
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from django.core import serializers
from api.models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences

print("=" * 60)
print("Importing data to PostgreSQL (Supabase)")
print("=" * 60)

# Load data
input_file = os.path.join(os.path.dirname(__file__), 'sqlite_data_export.json')
if not os.path.exists(input_file):
    print(f"[ERROR] Export file not found: {input_file}")
    print("Run scripts/export_sqlite_data.py first")
    sys.exit(1)

with open(input_file, 'r') as f:
    data = json.load(f)

# Import each model
models_map = {
    'questions': Question,
    'exams': Exam,
    'attempts': Attempt,
    'sessions': ExamSession,
    'plans': DailyPlan,
    'theme': ThemePreferences,
}

total = 0
for key, model_class in models_map.items():
    if key not in data:
        continue
    
    print(f"\nImporting {key}...")
    objects = serializers.deserialize('json', data[key])
    count = 0
    
    for obj in objects:
        try:
            obj.save()
            count += 1
            if count % 50 == 0:
                print(f"  Imported {count} {key}...")
        except Exception as e:
            print(f"  [ERROR] Failed to import {key}: {e}")
    
    print(f"[OK] Imported {count} {key}")
    total += count

print("\n" + "=" * 60)
print(f"[SUCCESS] Import complete! Total records: {total}")
print("=" * 60)

# Verify
print("\nVerifying data in PostgreSQL:")
print(f"  Questions: {Question.objects.count()}")
print(f"  Exams: {Exam.objects.count()}")
print(f"  Attempts: {Attempt.objects.count()}")
print(f"  Sessions: {ExamSession.objects.count()}")
print(f"  Daily Plans: {DailyPlan.objects.count()}")
print(f"  Theme Preferences: {ThemePreferences.objects.count()}")







