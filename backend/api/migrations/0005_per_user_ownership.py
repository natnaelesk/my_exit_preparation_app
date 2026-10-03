"""
Attach every model to an owning user.

DailyPlan, ThemePreferences and SubjectPriority previously used global natural
keys (date / fixed id / subject name) as primary keys, which cannot be shared
between users, so their tables are recreated with an auto id plus a per-owner
unique constraint. Relies on 0004 having emptied the tables.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def owner_fk(related_name, null=False):
    return models.ForeignKey(
        null=null,
        on_delete=django.db.models.deletion.CASCADE,
        related_name=related_name,
        to=settings.AUTH_USER_MODEL,
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0004_wipe_legacy_global_data'),
    ]

    operations = [
        # Models whose primary keys stay as-is: add a required owner FK.
        migrations.AddField(model_name='question', name='owner', field=owner_fk('questions', null=True)),
        migrations.AlterField(model_name='question', name='owner', field=owner_fk('questions')),
        migrations.AddField(model_name='exam', name='owner', field=owner_fk('exams', null=True)),
        migrations.AlterField(model_name='exam', name='owner', field=owner_fk('exams')),
        migrations.AddField(model_name='attempt', name='owner', field=owner_fk('attempts', null=True)),
        migrations.AlterField(model_name='attempt', name='owner', field=owner_fk('attempts')),
        migrations.AddField(model_name='examsession', name='owner', field=owner_fk('exam_sessions', null=True)),
        migrations.AlterField(model_name='examsession', name='owner', field=owner_fk('exam_sessions')),
        migrations.AddField(model_name='firebasecollection', name='owner', field=owner_fk('firebase_collections', null=True)),
        migrations.AlterField(model_name='firebasecollection', name='owner', field=owner_fk('firebase_collections')),
        migrations.AlterUniqueTogether(
            name='firebasecollection',
            unique_together={('owner', 'collection_name', 'document_id')},
        ),

        # Models keyed by global natural keys: recreate with per-owner uniqueness.
        migrations.DeleteModel(name='DailyPlan'),
        migrations.DeleteModel(name='ThemePreferences'),
        migrations.DeleteModel(name='SubjectPriority'),
        migrations.CreateModel(
            name='DailyPlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_key', models.CharField(db_column='dateKey', max_length=50)),
                ('focus_subject', models.CharField(db_column='focusSubject', max_length=255)),
                ('total_available_in_subject', models.IntegerField(db_column='totalAvailableInSubject', default=0)),
                ('max_planned_questions', models.IntegerField(db_column='maxPlannedQuestions', default=35)),
                ('question_ids', models.JSONField(db_column='questionIds', default=list)),
                ('answered_count', models.IntegerField(db_column='answeredCount', default=0)),
                ('correct_count', models.IntegerField(db_column='correctCount', default=0)),
                ('wrong_count', models.IntegerField(db_column='wrongCount', default=0)),
                ('accuracy', models.FloatField(default=0.0)),
                ('is_complete', models.BooleanField(db_column='isComplete', default=False)),
                ('motivational_quote', models.TextField(blank=True, db_column='motivationalQuote', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='createdAt')),
                ('last_updated', models.DateTimeField(auto_now=True, db_column='lastUpdated')),
                ('owner', owner_fk('daily_plans')),
            ],
            options={
                'db_table': 'dailyPlans',
                'ordering': ['-date_key'],
            },
        ),
        migrations.AddConstraint(
            model_name='dailyplan',
            constraint=models.UniqueConstraint(fields=('owner', 'date_key'), name='unique_daily_plan_per_owner'),
        ),
        migrations.CreateModel(
            name='ThemePreferences',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('favorite_light_theme', models.CharField(db_column='favoriteLightTheme', default='light', max_length=50)),
                ('favorite_dark_theme', models.CharField(db_column='favoriteDarkTheme', default='dark', max_length=50)),
                ('auto_mode', models.BooleanField(db_column='autoMode', default=False)),
                ('owner', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='theme_preferences',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'settings',
            },
        ),
        migrations.CreateModel(
            name='SubjectPriority',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject', models.CharField(max_length=255)),
                ('priority_order', models.IntegerField(default=0)),
                ('is_completed', models.BooleanField(default=False)),
                ('round_number', models.IntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('owner', owner_fk('subject_priorities')),
            ],
            options={
                'db_table': 'subjectPriorities',
                'ordering': ['priority_order', 'subject'],
            },
        ),
        migrations.AddConstraint(
            model_name='subjectpriority',
            constraint=models.UniqueConstraint(fields=('owner', 'subject'), name='unique_subject_priority_per_owner'),
        ),
    ]
