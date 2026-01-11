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
  EXCELLENT: 90,           // >= 90% accuracy
  VERY_GOOD: 80,           // >= 80% accuracy
  GOOD: 70,                // >= 70% accuracy
  MODERATE: 60,            // >= 60% accuracy
  NEED_IMPROVEMENT: 50,    // >= 50% accuracy
  NEED_IMPROVEMENT_VERY_MUCH: 30, // >= 30% accuracy
  DEAD_ZONE: 0             // < 30% accuracy
};

// Exam Modes
export const EXAM_MODES = {
  RANDOM: 'random',
  TOPIC_FOCUSED: 'topic-focused',
  WEAK_AREA: 'weak-area',
  SUBJECT: 'subject'
};

// Weak Area Selection Probabilities
export const WEAK_AREA_PROBABILITIES = {
  WEAK: 0.6,     // 60% chance
  MEDIUM: 0.3,   // 30% chance
  STRONG: 0.1    // 10% chance (only if pool exhausted)
};

