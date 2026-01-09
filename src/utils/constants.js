// Official 15 Subjects (Fixed & Authoritative)
export const OFFICIAL_SUBJECTS = [
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
  'Compiler Design'
];

// Subject Status Thresholds
export const STATUS_THRESHOLDS = {
  STRONG: 80,    // >= 80% accuracy
  MEDIUM: 60,    // 60-79% accuracy
  WEAK: 0        // < 60% accuracy
};

// Exam Modes
export const EXAM_MODES = {
  RANDOM: 'random',
  TOPIC_FOCUSED: 'topic-focused',
  WEAK_AREA: 'weak-area'
};

// Weak Area Selection Probabilities
export const WEAK_AREA_PROBABILITIES = {
  WEAK: 0.6,     // 60% chance
  MEDIUM: 0.3,   // 30% chance
  STRONG: 0.1    // 10% chance (only if pool exhausted)
};

