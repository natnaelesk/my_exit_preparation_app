-- Recalculate and reorder all subjects based on weakness scores
-- Run this to update priority order based on current performance data
-- Weakness score = (100 - accuracy) * ln(1 + totalAttempted)
-- Higher weakness score = weaker subject = higher priority (lower priority_order)

WITH subject_stats AS (
    SELECT 
        subject,
        COUNT(*) as total_attempted,
        SUM(CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END) as correct_count
    FROM attempts
    WHERE subject IN (
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
    )
    GROUP BY subject
),
weakness_scores AS (
    SELECT 
        subject,
        CASE 
            WHEN total_attempted > 0 THEN 
                (100.0 - (correct_count::numeric / total_attempted::numeric * 100.0)) * LN(1 + total_attempted)
            ELSE 1000.0  -- High score for subjects with no attempts
        END as weakness_score
    FROM subject_stats
),
all_subjects AS (
    SELECT 'Computer Programming' as subject
    UNION ALL SELECT 'Object Oriented Programming'
    UNION ALL SELECT 'Data Structures and Algorithms'
    UNION ALL SELECT 'Design and Analysis of Algorithms'
    UNION ALL SELECT 'Database Systems'
    UNION ALL SELECT 'Software Engineering'
    UNION ALL SELECT 'Web Programming'
    UNION ALL SELECT 'Operating System'
    UNION ALL SELECT 'Computer Organization and Architecture'
    UNION ALL SELECT 'Data Communication and Computer Networking'
    UNION ALL SELECT 'Computer Security'
    UNION ALL SELECT 'Network and System Administration'
    UNION ALL SELECT 'Introduction to Artificial Intelligence'
    UNION ALL SELECT 'Automata and Complexity Theory'
    UNION ALL SELECT 'Compiler Design'
),
ranked_subjects AS (
    SELECT 
        a.subject,
        COALESCE(ws.weakness_score, 1000.0) as weakness_score,
        ROW_NUMBER() OVER (ORDER BY COALESCE(ws.weakness_score, 1000.0) DESC) - 1 as priority_order
    FROM all_subjects a
    LEFT JOIN weakness_scores ws ON a.subject = ws.subject
)
-- Update existing subjects with new priority order
UPDATE "subjectPriorities" sp
SET 
    "priority_order" = rs.priority_order,
    "last_updated" = NOW()
FROM ranked_subjects rs
WHERE sp.subject = rs.subject;

-- Insert any missing subjects
INSERT INTO "subjectPriorities" ("subject", "priority_order", "is_completed", "round_number")
SELECT 
    rs.subject,
    rs.priority_order,
    FALSE as is_completed,
    1 as round_number
FROM ranked_subjects rs
WHERE NOT EXISTS (
    SELECT 1 FROM "subjectPriorities" WHERE subject = rs.subject
);

-- Verify
SELECT * FROM "subjectPriorities" ORDER BY "priority_order";

