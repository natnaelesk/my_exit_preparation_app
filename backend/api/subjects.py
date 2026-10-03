"""Official exit-exam subjects and normalization of common name variants."""

OFFICIAL_SUBJECTS = [
    'Computer Programming',
    'Object Oriented Programming',
    'Data Structures and Algorithms',
    'Design and Analysis of Algorithms',
    'Database Systems',
    'Software Engineering',
    'Web Programming',
    'Operating System',
    'Computer Organization and Architecture',
    'Data Communication and Computer Networking',
    'Computer Security',
    'Network and System Administration',
    'Introduction to Artificial Intelligence',
    'Automata and Complexity Theory',
    'Compiler Design',
]

# Mirrors SUBJECT_MAPPING in src/services/uploadService.js.
SUBJECT_ALIASES = {
    'fundamental of database systems': 'Database Systems',
    'fundamentals of database systems': 'Database Systems',
    'advance database systems': 'Database Systems',
    'advanced database systems': 'Database Systems',
    'computer organization & architecture': 'Computer Organization and Architecture',
    'data structure and algorithms': 'Data Structures and Algorithms',
    'data structures and algorithm': 'Data Structures and Algorithms',
    'oop': 'Object Oriented Programming',
    'operating systems': 'Operating System',
    'computer networking': 'Data Communication and Computer Networking',
    'artificial intelligence': 'Introduction to Artificial Intelligence',
    'ai': 'Introduction to Artificial Intelligence',
}

_BY_LOWER = {subject.lower(): subject for subject in OFFICIAL_SUBJECTS}


def normalize_subject(value):
    """Return the official subject name for value, or None if unrecognized."""
    key = ' '.join(str(value or '').split()).lower()
    return _BY_LOWER.get(key) or SUBJECT_ALIASES.get(key)
