import { OFFICIAL_SUBJECTS } from './constants';

/**
 * Maps common variations to official subject names.
 * Used on both upload and read, so the app can recover from older data inconsistencies.
 */
export const SUBJECT_MAPPING = {
  'fundamental of database systems': 'Database Systems',
  'fundamentals of database systems': 'Database Systems',
  'database systems': 'Database Systems',
  'advance database systems': 'Database Systems',
  'advanced database systems': 'Database Systems',
  'computer organization and architecture': 'Computer Organization and Architecture',
  'computer organization & architecture': 'Computer Organization and Architecture',
  'data structure and algorithms': 'Data Structures and Algorithms',
  'data structures and algorithm': 'Data Structures and Algorithms',
  'data structures and algorithms': 'Data Structures and Algorithms',
  'object oriented programming': 'Object Oriented Programming',
  'oop': 'Object Oriented Programming',
  'design and analysis of algorithms': 'Design and Analysis of Algorithms',
  'web programming': 'Web Programming',
  'software engineering': 'Software Engineering',
  'operating system': 'Operating System',
  'operating systems': 'Operating System',
  'data communication and computer networking': 'Data Communication and Computer Networking',
  'computer networking': 'Data Communication and Computer Networking',
  'computer security': 'Computer Security',
  'network and system administration': 'Network and System Administration',
  'introduction to artificial intelligence': 'Introduction to Artificial Intelligence',
  'artificial intelligence': 'Introduction to Artificial Intelligence',
  'ai': 'Introduction to Artificial Intelligence',
  'automata and complexity theory': 'Automata and Complexity Theory',
  'automata': 'Automata and Complexity Theory',
  'automata & complexity theory': 'Automata and Complexity Theory',
  'compiler design': 'Compiler Design',
  'computer programming': 'Computer Programming',
};

export const normalizeSubject = (subject) => {
  if (!subject || typeof subject !== 'string') return null;

  const normalized = subject.trim();
  const lower = normalized.toLowerCase();

  if (OFFICIAL_SUBJECTS.includes(normalized)) return normalized;
  if (SUBJECT_MAPPING[lower]) return SUBJECT_MAPPING[lower];

  const ciMatch = OFFICIAL_SUBJECTS.find((s) => s.toLowerCase() === lower);
  if (ciMatch) return ciMatch;

  return null;
};

export const normalizeTopic = (topic) => {
  if (!topic || typeof topic !== 'string') return 'Unknown';
  const t = topic.trim();
  return t || 'Unknown';
};


