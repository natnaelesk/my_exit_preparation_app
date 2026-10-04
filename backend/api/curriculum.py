"""Per-user curriculum from the active exit-exam blueprint: course lookup, subject matching, apply and activate."""

import re

from django.contrib.auth import get_user_model
from django.db import transaction

from .models import BlueprintCourse, SubjectPriority, UserBlueprint

NO_CURRICULUM = 'Upload and apply your exit exam blueprint first (Curriculum page); it defines your courses.'

FILLER_PREFIXES = (
    'fundamentals of ', 'fundamental of ', 'introduction to ', 'intro to ', 'principles of ', 'basics of ',
    'advanced ', 'advance ',
)
WORD_RE = re.compile(r'[a-z0-9+#]+')


def active_blueprint(owner):
    return UserBlueprint.objects.filter(owner=owner, is_active=True).first()


def active_courses(owner):
    return list(BlueprintCourse.objects.filter(blueprint__owner=owner, blueprint__is_active=True))


def active_course_names(owner):
    return [course.name for course in active_courses(owner)]


def course_key(value):
    """A comparison key that ignores case, '&' vs 'and', plurals and filler prefixes like 'Fundamentals of'."""
    text = ' '.join(str(value or '').lower().replace('&', ' and ').split())
    for prefix in FILLER_PREFIXES:
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    words = WORD_RE.findall(text)
    return ' '.join(word[:-1] if len(word) > 3 and word.endswith('s') else word for word in words)


def match_course(value, course_names):
    """The name in course_names that value refers to, or '' when it matches none (or is ambiguous)."""
    key = course_key(value)
    if not key:
        return ''
    by_key = {}
    for name in course_names:
        by_key.setdefault(course_key(name), name)
    if key in by_key:
        return by_key[key]
    partial = [name for candidate, name in by_key.items()
               if min(len(key), len(candidate)) >= 4 and (key in candidate or candidate in key)]
    return partial[0] if len(partial) == 1 else ''


def course_for_subject(owner, subject):
    """The active blueprint course a study subject refers to, or None."""
    courses = active_courses(owner)
    name = match_course(subject, [course.name for course in courses])
    return next((course for course in courses if course.name == name), None)


# ---------------------------------------------------------------------------
# Apply / activate
# ---------------------------------------------------------------------------

def _lock_owner(owner):
    """Serialize curriculum changes per user so two requests cannot both leave a blueprint active."""
    get_user_model().objects.select_for_update().filter(pk=owner.pk).first()


def _priority_rank(course):
    return (
        -(course.item_count if course.item_count is not None else -1),
        -(course.weight if course.weight is not None else -1),
        course.theme_order,
        course.sort_order,
    )


def rebuild_priorities(owner, blueprint):
    """Make the user's SubjectPriority rows exactly the blueprint's courses, keeping progress on shared names."""
    courses = sorted(blueprint.courses.all(), key=_priority_rank)
    names = [course.name for course in courses]
    SubjectPriority.objects.filter(owner=owner).exclude(subject__in=names).delete()
    existing = {p.subject: p for p in SubjectPriority.objects.filter(owner=owner)}
    for order, name in enumerate(names):
        priority = existing.get(name)
        if priority is None:
            SubjectPriority.objects.create(owner=owner, subject=name, priority_order=order)
        elif priority.priority_order != order:
            priority.priority_order = order
            priority.save(update_fields=['priority_order', 'last_updated'])


def apply_blueprint(owner, draft, source_import=None, label=''):
    """Append a validated draft to the user's blueprint history, make it the active one, and rebuild priorities."""
    with transaction.atomic():
        _lock_owner(owner)
        UserBlueprint.objects.filter(owner=owner, is_active=True).update(is_active=False)
        blueprint = UserBlueprint.objects.create(
            owner=owner,
            program_name=draft['programName'],
            label=label[:255],
            source_import=source_import,
            is_active=True,
        )
        BlueprintCourse.objects.bulk_create([
            BlueprintCourse(
                blueprint=blueprint,
                name=course['name'],
                theme_name=theme['name'],
                theme_order=theme['order'],
                theme_credit_hours=theme['creditHours'],
                theme_item_share=theme['itemShare'],
                credit_hours=course['creditHours'],
                item_count=course['itemCount'],
                weight=course['weight'],
                focus_notes=course['focusNotes'],
                sort_order=course['order'],
            )
            for theme in draft['themes']
            for course in theme['courses']
        ])
        rebuild_priorities(owner, blueprint)
    return blueprint


def activate_blueprint(owner, blueprint):
    """Switch the user's active blueprint to one from their history and rebuild priorities."""
    with transaction.atomic():
        _lock_owner(owner)
        UserBlueprint.objects.filter(owner=owner, is_active=True).exclude(pk=blueprint.pk).update(is_active=False)
        UserBlueprint.objects.filter(pk=blueprint.pk, owner=owner).update(is_active=True)
        blueprint.refresh_from_db()
        rebuild_priorities(owner, blueprint)
    return blueprint


def blueprint_themes(blueprint):
    """The applied blueprint in the same themes/courses shape as an import draft."""
    themes = []
    for course in blueprint.courses.all():
        if not themes or themes[-1]['order'] != course.theme_order or themes[-1]['name'] != course.theme_name:
            themes.append({
                'name': course.theme_name,
                'creditHours': course.theme_credit_hours,
                'itemShare': course.theme_item_share,
                'order': course.theme_order,
                'courses': [],
            })
        themes[-1]['courses'].append({
            'name': course.name,
            'creditHours': course.credit_hours,
            'itemCount': course.item_count,
            'weight': course.weight,
            'focusNotes': course.focus_notes,
            'order': course.sort_order,
        })
    return themes
