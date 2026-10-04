import { useMemo, useState } from 'react';
import { applyBlueprintImport } from '../../services/blueprintService';

let nextKey = 0;
const newKey = (prefix) => `${prefix}${nextKey++}`;

const numberText = (value) => (value === null || value === undefined ? '' : String(value));

const toEditableCourse = (course = {}) => ({
  key: newKey('c'),
  name: course.name || '',
  creditHours: numberText(course.creditHours),
  itemCount: numberText(course.itemCount),
  weight: numberText(course.weight),
  focusNotes: course.focusNotes || '',
});

const toEditableTheme = (theme = {}) => ({
  key: newKey('t'),
  name: theme.name || '',
  creditHours: numberText(theme.creditHours),
  itemShare: numberText(theme.itemShare),
  courses: (theme.courses || []).map(toEditableCourse),
});

const toNumber = (text, integer = false) => {
  const trimmed = String(text).trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return integer ? Math.round(value) : value;
};

const toPayload = (programName, themes) => ({
  programName: programName.trim(),
  themes: themes.map((theme) => ({
    name: theme.name.trim(),
    creditHours: toNumber(theme.creditHours),
    itemShare: toNumber(theme.itemShare),
    courses: theme.courses.map((course) => ({
      name: course.name.trim(),
      creditHours: toNumber(course.creditHours),
      itemCount: toNumber(course.itemCount, true),
      weight: toNumber(course.weight),
      focusNotes: course.focusNotes.trim(),
    })),
  })),
});

// Mirrors validate_draft in backend/api/blueprint_extraction.py.
const validate = (draft) => {
  const errors = [];
  const courses = draft.themes.flatMap((theme) => theme.courses);
  if (!draft.programName) errors.push('Give the program a name.');
  if (courses.length === 0) errors.push('Add at least one course.');
  const seen = new Set();
  draft.themes.forEach((theme, index) => {
    if (!theme.name) errors.push(`Theme ${index + 1} needs a name.`);
    theme.courses.forEach((course) => {
      if (!course.name) {
        errors.push(`A course in "${theme.name || `theme ${index + 1}`}" needs a name.`);
        return;
      }
      const lower = course.name.toLowerCase();
      if (seen.has(lower)) errors.push(`"${course.name}" appears more than once; each course can only be listed once.`);
      seen.add(lower);
    });
  });
  return [...new Set(errors)];
};

const NumberField = ({ label, value, onChange, step = 'any' }) => (
  <label className="block text-xs text-muted">
    {label}
    <input type="number" min="0" step={step} className="input py-2 mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
  </label>
);

const CourseEditor = ({ course, onChange, onRemove }) => {
  const update = (fields) => onChange({ ...course, ...fields });
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="input py-2 flex-1"
          value={course.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Course name"
          aria-label="Course name"
        />
        <button type="button" className="text-sm text-red-400 hover:text-red-300 px-2" onClick={onRemove}>Remove</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Credit hours" value={course.creditHours} onChange={(v) => update({ creditHours: v })} />
        <NumberField label="Exam items" value={course.itemCount} step="1" onChange={(v) => update({ itemCount: v })} />
        <NumberField label="Weight (%)" value={course.weight} onChange={(v) => update({ weight: v })} />
      </div>
      <textarea
        className="input min-h-[70px] text-sm"
        value={course.focusNotes}
        onChange={(e) => update({ focusNotes: e.target.value })}
        placeholder="Focus notes: what the blueprint says is examined (one point per line)"
        aria-label={`${course.name || 'Course'} focus notes`}
      />
    </div>
  );
};

const ThemeEditor = ({ index, theme, onChange, onRemove }) => {
  const update = (fields) => onChange({ ...theme, ...fields });
  const updateCourse = (key, updated) => update({ courses: theme.courses.map((c) => (c.key === key ? updated : c)) });
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-text">Theme {index + 1}</span>
        <button type="button" className="text-sm text-red-400 hover:text-red-300" onClick={onRemove}>Remove theme</button>
      </div>
      <input
        className="input"
        value={theme.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="Theme name"
        aria-label={`Theme ${index + 1} name`}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Theme credit hours" value={theme.creditHours} onChange={(v) => update({ creditHours: v })} />
        <NumberField label="Share of exam items (%)" value={theme.itemShare} onChange={(v) => update({ itemShare: v })} />
      </div>
      <div className="space-y-2">
        {theme.courses.map((course) => (
          <CourseEditor
            key={course.key}
            course={course}
            onChange={(updated) => updateCourse(course.key, updated)}
            onRemove={() => update({ courses: theme.courses.filter((c) => c.key !== course.key) })}
          />
        ))}
        <button
          type="button"
          className="text-sm text-primary-500"
          onClick={() => update({ courses: [...theme.courses, toEditableCourse()] })}
        >
          + Add course
        </button>
      </div>
    </div>
  );
};

const BlueprintReview = ({ blueprintImport, onApplied, onCancel }) => {
  const [programName, setProgramName] = useState(blueprintImport.draft?.programName || '');
  const [themes, setThemes] = useState(() => (blueprintImport.draft?.themes || []).map(toEditableTheme));
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState(null);
  const [serverErrors, setServerErrors] = useState([]);

  const draft = useMemo(() => toPayload(programName, themes), [programName, themes]);
  const errors = useMemo(() => validate(draft), [draft]);
  const courseCount = draft.themes.reduce((sum, theme) => sum + theme.courses.length, 0);
  const itemTotal = draft.themes.reduce(
    (sum, theme) => sum + theme.courses.reduce((s, c) => s + (c.itemCount || 0), 0), 0,
  );

  const updateTheme = (key, updated) => {
    setThemes((prev) => prev.map((t) => (t.key === key ? updated : t)));
    setServerErrors([]);
  };

  const handleApply = async () => {
    setError(null);
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    const confirmed = window.confirm(
      `Apply "${draft.programName}" with ${courseCount} courses?\n\n` +
      'It becomes your active curriculum and your subject priorities are rebuilt from its courses ' +
      '(completion on courses with the same name is kept). Earlier blueprints stay in your history.'
    );
    if (!confirmed) return;
    setIsApplying(true);
    try {
      const result = await applyBlueprintImport(blueprintImport.id, draft);
      onApplied(result.blueprint);
    } catch (err) {
      setServerErrors(err.draftErrors || []);
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const shownErrors = [...new Set([...errors, ...serverErrors])];

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <h3 className="text-lg font-bold text-text">Review your curriculum</h3>
          <p className="text-sm text-muted">
            The AI can misread scanned tables. Check the program, themes, courses, credit hours, exam item counts and
            focus notes against your blueprint before applying.
          </p>
        </div>
        <label className="block text-sm font-medium text-text" htmlFor="blueprint-program">Program</label>
        <input
          id="blueprint-program"
          className="input"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="e.g. Computer Science, Civil Engineering, Nursing"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-text">{themes.length} theme(s) · {courseCount} course(s){itemTotal > 0 ? ` · ${itemTotal} exam items` : ''}</span>
          {shownErrors.length > 0 ? (
            <span className="text-red-400">{shownErrors.length} problem(s) to fix</span>
          ) : (
            <span className="text-green-500">Ready to apply</span>
          )}
        </div>
        {shownErrors.length > 0 && (
          <ul className="text-sm text-red-400 list-disc list-inside">
            {shownErrors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
      </div>

      {themes.map((theme, index) => (
        <ThemeEditor
          key={theme.key}
          index={index}
          theme={theme}
          onChange={(updated) => updateTheme(theme.key, updated)}
          onRemove={() => setThemes((prev) => prev.filter((t) => t.key !== theme.key))}
        />
      ))}

      <button
        type="button"
        className="btn-secondary w-full"
        onClick={() => setThemes((prev) => [...prev, toEditableTheme({ courses: [{}] })])}
      >
        + Add a theme the AI missed
      </button>

      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-400" role="alert">{error}</div>
      )}

      <div className="flex gap-3 sticky bottom-20 md:bottom-4">
        <button type="button" className="btn-primary flex-1 shadow-lg" onClick={handleApply} disabled={isApplying}>
          {isApplying ? 'Applying...' : `Apply curriculum (${courseCount} courses)`}
        </button>
        <button type="button" className="btn-secondary flex-1 shadow-lg" onClick={onCancel} disabled={isApplying}>
          Discard
        </button>
      </div>
    </div>
  );
};

export default BlueprintReview;
