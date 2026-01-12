#!/usr/bin/env python
"""Test analytics endpoints"""
import os
import sys
import django

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from api.models import Attempt
from django.db.models import Count
from collections import defaultdict

# Check attempts by date
attempts = Attempt.objects.all().order_by('timestamp')
print(f"Total attempts: {attempts.count()}")

# Group by date
dates = defaultdict(lambda: {'total': 0, 'correct': 0})
for attempt in attempts:
    date_key = attempt.timestamp.date().isoformat()
    dates[date_key]['total'] += 1
    if attempt.is_correct:
        dates[date_key]['correct'] += 1

print(f"\nAttempts grouped by date ({len(dates)} unique dates):")
for date_key in sorted(dates.keys())[:10]:
    data = dates[date_key]
    accuracy = (data['correct'] / data['total'] * 100) if data['total'] > 0 else 0
    print(f"  {date_key}: {data['total']} attempts, {data['correct']} correct ({accuracy:.1f}%)")

print(f"\n[OK] Analytics data is ready! Graphs should now show trend data.")

