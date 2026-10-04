"""
One-time reset of subject priorities.

Before prompt 07 every user's priorities were auto-created from a hardcoded list of 15 Computer Science
courses. Subjects now come only from the user's active exit-exam blueprint, so the seeded rows are
deleted; users get priorities again by uploading and applying their own blueprint.
"""

from django.db import migrations


def clear_subject_priorities(apps, schema_editor):
    apps.get_model('api', 'SubjectPriority').objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_blueprint_curriculum'),
    ]

    operations = [
        migrations.RunPython(clear_subject_priorities, migrations.RunPython.noop),
    ]
