"""
One-time wipe of pre-v0.2 global (ownerless) rows.

v0.2 makes every row belong to a user, and each new user starts with an empty
canvas, so legacy shared rows are deleted instead of being reassigned.
Back up the database before applying this migration if the old data matters.
This runs as its own migration so the schema changes in 0005 apply to empty
tables in a separate transaction.
"""

from django.db import migrations


LEGACY_MODELS = [
    'Attempt',
    'ExamSession',
    'DailyPlan',
    'Exam',
    'Question',
    'ThemePreferences',
    'SubjectPriority',
    'FirebaseCollection',
]


def wipe_legacy_rows(apps, schema_editor):
    for model_name in LEGACY_MODELS:
        apps.get_model('api', model_name).objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_subject_priority'),
    ]

    operations = [
        migrations.RunPython(wipe_legacy_rows, migrations.RunPython.noop),
    ]
