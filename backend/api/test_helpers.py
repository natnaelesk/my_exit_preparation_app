"""Shared fixtures for tests that need a user with an applied exit-exam blueprint."""

from .blueprint_extraction import clean_draft
from .curriculum import apply_blueprint

SAMPLE_DRAFT = {
    'programName': 'Computer Science (sample)',
    'themes': [
        {'name': 'Programming', 'creditHours': 12, 'itemShare': 30, 'courses': [
            {'name': 'Data Structures and Algorithms', 'creditHours': 4, 'itemCount': 12, 'weight': 12,
             'focusNotes': '- Stacks, queues, trees\n- Big-O analysis'},
            {'name': 'Object Oriented Programming', 'creditHours': 4, 'itemCount': 8, 'weight': 8,
             'focusNotes': '- Inheritance and polymorphism'},
        ]},
        {'name': 'Systems', 'creditHours': 10, 'itemShare': 25, 'courses': [
            {'name': 'Database Systems', 'creditHours': 4, 'itemCount': 10, 'weight': 10,
             'focusNotes': '- Normalization up to BCNF\n- SQL joins'},
            {'name': 'Compiler Design', 'creditHours': 3, 'itemCount': 5, 'weight': 5, 'focusNotes': ''},
        ]},
    ],
}


def give_curriculum(user, draft=None, label='sample.pdf'):
    """Apply a blueprint for user (the sample CS one by default) and return the new active UserBlueprint."""
    return apply_blueprint(user, clean_draft(draft or SAMPLE_DRAFT), label=label)
