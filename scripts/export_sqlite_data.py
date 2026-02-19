#!/usr/bin/env python
"""Export SQLite data to JSON"""
import os
import sys
import json
import django

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

# Use SQLite
if 'DATABASE_URL' in os.environ:
    del os.environ['DATABASE_URL']

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from api.models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences
from django.core import serializers

print("Exporting data from SQLite...")

# Serialize all data
data = {
    'questions': serializers.serialize('json', Question.objects.all()),
    'exams': serializers.serialize('json', Exam.objects.all()),
    'attempts': serializers.serialize('json', Attempt.objects.all()),
    'sessions': serializers.serialize('json', ExamSession.objects.all()),
    'plans': serializers.serialize('json', DailyPlan.objects.all()),
    'theme': serializers.serialize('json', ThemePreferences.objects.all()),
}

# Save to file
output_file = os.path.join(os.path.dirname(__file__), 'sqlite_data_export.json')
with open(output_file, 'w') as f:
    json.dump(data, f)

print(f"[OK] Exported data to {output_file}")
print(f"  Questions: {Question.objects.count()}")
print(f"  Exams: {Exam.objects.count()}")
print(f"  Attempts: {Attempt.objects.count()}")
print(f"  Sessions: {ExamSession.objects.count()}")
print(f"  Daily Plans: {DailyPlan.objects.count()}")
print(f"  Theme Preferences: {ThemePreferences.objects.count()}")







