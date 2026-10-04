import { useMemo, useState } from 'react';
import { useCurriculum } from '../../contexts/CurriculumContext';
import { matchCourse } from '../../utils/subjectNormalization';
import { publishExamImport } from '../../services/examImportService';

let nextKey = 0;
const newKey = () => `q${nextKey++}`;

const toEditable = (q, subjects) => ({
  key: newKey(),
  question: q.question || '',
  choices: q.choices?.length ? [...q.choices] : ['', ''],
  correctIndex: q.choices ? q.choices.indexOf(q.correctAnswer) : -1,
  explanation: q.explanation || '',
  subject: matchCourse(q.subject, subjects) || '',
  topic: q.topic || '',
  sourcePages: q.sourcePages || [],
});

const blankQuestion = () => toEditable({ choices: ['', '', '', ''], topic: 'General' }, []);

// Mirrors validate_question in backend/api/exam_extraction.py.
const validate = (q, subjects) => {
  const errors = [];
  const choices = q.choices.map((c) => c.trim());
  if (!q.question.trim()) errors.push('Question text is empty.');
  if (choices.length < 2) errors.push('Needs at least 2 choices.');
  if (choices.some((c) => !c)) errors.push('Choices cannot be empty.');
  if (new Set(choices).size !== choices.length) errors.push('Choices must be different from each other.');
  if (q.correctIndex < 0 || q.correctIndex >= choices.length) errors.push('Pick the correct answer.');
  if (!subjects.includes(q.subject)) errors.push('Pick a subject from your curriculum.');
  return errors;
};

const toPayload = (q) => ({
  question: q.question.trim(),
  choices: q.choices.map((c) => c.trim()),
  correctAnswer: q.choices[q.correctIndex]?.trim() || '',
  explanation: q.explanation.trim(),
  subject: q.subject,
  topic: q.topic.trim(),
});

const QuestionEditor = ({ index, q, errors, subjects, onChange, onRemove }) => {
  const update = (fields) => onChange({ ...q, ...fields });

  const updateChoice = (choiceIndex, value) => {
    const choices = [...q.choices];
    choices[choiceIndex] = value;
    update({ choices });
  };

  const removeChoice = (choiceIndex) => {
    const choices = q.choices.filter((_, i) => i !== choiceIndex);
    let correctIndex = q.correctIndex;
    if (choiceIndex === correctIndex) correctIndex = -1;
    else if (choiceIndex < correctIndex) correctIndex -= 1;
    update({ choices, correctIndex });
  };

  return (
    <div className={`card space-y-3 ${errors.length ? 'border-red-500/70' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-text">
          Question {index + 1}
          {q.sourcePages.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              page {q.sourcePages.join(', ')}
            </span>
          )}
        </span>
        <button type="button" className="text-sm text-red-400 hover:text-red-300" onClick={onRemove}>
          Remove
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="text-sm text-red-400 list-disc list-inside">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}

      <textarea
        className="input min-h-[80px]"
        value={q.question}
        onChange={(e) => update({ question: e.target.value })}
        placeholder="Question text"
        aria-label={`Question ${index + 1} text`}
      />

      <div className="space-y-2">
        <p className="text-xs text-muted">Choices: select the correct one</p>
        {q.choices.map((choice, choiceIndex) => (
          <div key={choiceIndex} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${q.key}`}
              checked={q.correctIndex === choiceIndex}
              onChange={() => update({ correctIndex: choiceIndex })}
              aria-label={`Mark choice ${choiceIndex + 1} correct`}
              className="accent-primary-500 w-4 h-4 flex-shrink-0"
            />
            <input
              className="input py-2"
              value={choice}
              onChange={(e) => updateChoice(choiceIndex, e.target.value)}
              placeholder={`Choice ${String.fromCharCode(65 + choiceIndex)}`}
            />
            <button
              type="button"
              className="text-muted hover:text-red-400 px-2"
              onClick={() => removeChoice(choiceIndex)}
              aria-label={`Remove choice ${choiceIndex + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        {q.choices.length < 8 && (
          <button type="button" className="text-sm text-primary-500" onClick={() => update({ choices: [...q.choices, ''] })}>
            + Add choice
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select
          className="input"
          value={q.subject}
          onChange={(e) => update({ subject: e.target.value })}
          aria-label={`Question ${index + 1} subject`}
        >
          <option value="">Select subject…</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>{subject}</option>
          ))}
        </select>
        <input
          className="input"
          value={q.topic}
          onChange={(e) => update({ topic: e.target.value })}
          placeholder="Topic"
          aria-label={`Question ${index + 1} topic`}
        />
      </div>

      <textarea
        className="input min-h-[60px] text-sm"
        value={q.explanation}
        onChange={(e) => update({ explanation: e.target.value })}
        placeholder="Explanation (1–2 sentences)"
        aria-label={`Question ${index + 1} explanation`}
      />
    </div>
  );
};

const ExamImportReview = ({ examImport, onPublished, onCancel }) => {
  const { subjects } = useCurriculum();
  const [title, setTitle] = useState(
    examImport.title || examImport.originalFilename.replace(/\.pdf$/i, '')
  );
  const [questions, setQuestions] = useState(() => examImport.questions.map((q) => toEditable(q, subjects)));
  const [serverErrors, setServerErrors] = useState({});
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState(null);

  const errorsByKey = useMemo(() => {
    const result = {};
    questions.forEach((q) => {
      result[q.key] = [...new Set([...validate(q, subjects), ...(serverErrors[q.key] || [])])];
    });
    return result;
  }, [questions, serverErrors, subjects]);

  const problemCount = questions.filter((q) => errorsByKey[q.key].length > 0).length;
  const visible = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !onlyProblems || errorsByKey[q.key].length > 0);

  const updateQuestion = (key, updated) => {
    setQuestions((prev) => prev.map((q) => (q.key === key ? updated : q)));
    setServerErrors((prev) => ({ ...prev, [key]: [] }));
  };

  const handlePublish = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Give the exam a title.');
      return;
    }
    if (questions.length === 0) {
      setError('Add at least one question before publishing.');
      return;
    }
    if (problemCount > 0) {
      setError(`${problemCount} question(s) need fixing before publishing.`);
      setOnlyProblems(true);
      return;
    }

    setIsPublishing(true);
    try {
      const result = await publishExamImport(examImport.id, title.trim(), questions.map(toPayload));
      onPublished(result.exam);
    } catch (err) {
      const byKey = {};
      err.questionErrors?.forEach(({ index, errors }) => {
        if (questions[index]) byKey[questions[index].key] = errors;
      });
      setServerErrors(byKey);
      if (err.questionErrors?.length) setOnlyProblems(true);
      setError(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <h3 className="text-lg font-bold text-text">Review extracted questions</h3>
          <p className="text-sm text-muted">
            The AI can misread photo pages. Check each question, its choices and the correct answer before publishing.
          </p>
        </div>
        <label className="block text-sm font-medium text-text" htmlFor="import-title">Exam title</label>
        <input id="import-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-text">{questions.length} question(s)</span>
          {problemCount > 0 ? (
            <span className="text-red-400">{problemCount} need fixing</span>
          ) : (
            <span className="text-green-500">All look valid</span>
          )}
          <label className="flex items-center gap-2 text-muted ml-auto">
            <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
            Show only questions needing fixes
          </label>
        </div>
      </div>

      {visible.map(({ q, index }) => (
        <QuestionEditor
          key={q.key}
          index={index}
          q={q}
          errors={errorsByKey[q.key]}
          subjects={subjects}
          onChange={(updated) => updateQuestion(q.key, updated)}
          onRemove={() => setQuestions((prev) => prev.filter((item) => item.key !== q.key))}
        />
      ))}

      {!onlyProblems && (
        <button type="button" className="btn-secondary w-full" onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}>
          + Add a question the AI missed
        </button>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-400" role="alert">{error}</div>
      )}

      <div className="flex gap-3 sticky bottom-20 md:bottom-4">
        <button type="button" className="btn-primary flex-1 shadow-lg" onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? 'Publishing...' : `Publish exam (${questions.length} questions)`}
        </button>
        <button type="button" className="btn-secondary flex-1 shadow-lg" onClick={onCancel} disabled={isPublishing}>
          Discard
        </button>
      </div>
    </div>
  );
};

export default ExamImportReview;
