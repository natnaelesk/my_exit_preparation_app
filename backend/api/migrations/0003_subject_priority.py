# Generated migration for SubjectPriority model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_add_firebase_collection'),
    ]

    operations = [
        migrations.CreateModel(
            name='SubjectPriority',
            fields=[
                ('subject', models.CharField(max_length=255, primary_key=True, serialize=False)),
                ('priority_order', models.IntegerField(default=0)),
                ('is_completed', models.BooleanField(default=False)),
                ('round_number', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_updated', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'subjectPriorities',
                'ordering': ['priority_order', 'subject'],
            },
        ),
    ]

