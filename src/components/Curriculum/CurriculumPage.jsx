import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useCurriculum } from '../../contexts/CurriculumContext';
import {
  activateBlueprint,
  deleteBlueprintImport,
  listBlueprintImports,
  listBlueprints,
  startBlueprintExtraction,
  uploadBlueprintPdf,
  waitForBlueprintExtraction,
} from '../../services/blueprintService';
import BlueprintReview from './BlueprintReview';

const MAX_UPLOAD_MB = 25;

const draftCourseCount = (draft) => (draft?.themes || []).reduce((sum, theme) => sum + theme.courses.length, 0);

const progressLabel = (item) => {
  const first = item.pagesProcessed + 1;
  const last = Math.min(item.pagesProcessed + item.pagesPerBatch, item.pageCount);
  return first === last
    ? `Reading page ${first} of ${item.pageCount}…`
    : `Reading pages ${first}–${last} of ${item.pageCount}…`;
};

const formatDate = (value) => {
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return '';
  }
};

const ActiveCurriculum = ({ blueprint }) => {
  const [openCourse, setOpenCourse] = useState(null);
  return (
    <div className="card space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Active curriculum</p>
        <h2 className="text-xl font-bold text-text">{blueprint.programName}</h2>
        <p className="text-xs text-muted">
          {blueprint.courseCount} courses · applied {formatDate(blueprint.appliedAt)}
          {blueprint.label ? ` · from ${blueprint.label}` : ''}
        </p>
      </div>
      {blueprint.themes.map((theme) => (
        <div key={`${theme.order}-${theme.name}`} className="space-y-1">
          <h3 className="text-sm font-semibold text-text">
            {theme.name || 'Untitled theme'}
            <span className="font-normal text-muted">
              {theme.creditHours != null ? ` · ${theme.creditHours} cr` : ''}
              {theme.itemShare != null ? ` · ${theme.itemShare}% of items` : ''}
            </span>
          </h3>
          {theme.courses.map((course) => {
            const key = `${theme.order}-${course.name}`;
            const open = openCourse === key;
            return (
              <div key={key} className="rounded-lg bg-surface px-3 py-2">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 text-left text-sm"
                  onClick={() => setOpenCourse(open ? null : key)}
                  aria-expanded={open}
                >
                  <span className="text-text">{course.name}</span>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {course.itemCount != null ? `${course.itemCount} items` : ''}
                    {course.creditHours != null ? ` · ${course.creditHours} cr` : ''}
                    {course.focusNotes ? (open ? ' ▲' : ' ▼') : ''}
                  </span>
                </button>
                {open && course.focusNotes && (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted">{course.focusNotes}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const CurriculumPage = () => {
  const { blueprint, loading, refresh } = useCurriculum();
  const [history, setHistory] = useState([]);
  const [unfinished, setUnfinished] = useState([]);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState('select'); // select | uploading | extracting | stopped | review
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [switchingId, setSwitchingId] = useState(null);
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);

  const loadLists = useCallback(async () => {
    const [blueprints, imports] = await Promise.all([listBlueprints(), listBlueprintImports()]);
    if (cancelledRef.current) return;
    setHistory(blueprints);
    setUnfinished(imports.filter((item) => item.status !== 'applied'));
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    loadLists().catch((err) => setError(err.message));
    return () => { cancelledRef.current = true; };
  }, [loadLists]);

  const chooseFile = (candidate) => {
    setError(null);
    if (!candidate) return;
    if (candidate.type !== 'application/pdf' && !candidate.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`The PDF is larger than ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    setFile(candidate);
  };

  const followExtraction = async (item) => {
    setCurrent(item);
    setPhase('extracting');
    const final = await waitForBlueprintExtraction(item.id, {
      onUpdate: setCurrent,
      isCancelled: () => cancelledRef.current,
    });
    if (cancelledRef.current) return;
    setCurrent(final);
    setPhase(final.status === 'ready' && draftCourseCount(final.draft) > 0 ? 'review' : 'stopped');
  };

  const runExtraction = async (item) => {
    setError(null);
    try {
      let started = item;
      try {
        started = await startBlueprintExtraction(item.id);
      } catch (err) {
        if (err.status !== 409) throw err; // 409: already running/finished; just follow it
      }
      await followExtraction(started);
    } catch (err) {
      setError(err.message);
      setPhase('stopped');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setNotice(null);
    setPhase('uploading');
    try {
      const created = await uploadBlueprintPdf(file);
      setCurrent(created);
      await runExtraction(created);
    } catch (err) {
      setError(err.message);
      setPhase('select');
    }
  };

  const resume = (item) => {
    setNotice(null);
    setUnfinished((prev) => prev.filter((i) => i.id !== item.id));
    if (item.status === 'ready' && draftCourseCount(item.draft) > 0) {
      setCurrent(item);
      setPhase('review');
    } else if (item.status === 'extracting') {
      followExtraction(item).catch((err) => { setError(err.message); setPhase('stopped'); });
    } else {
      setCurrent(item);
      runExtraction(item);
    }
  };

  const reset = () => {
    setFile(null);
    setCurrent(null);
    setError(null);
    setPhase('select');
  };

  const discard = async (item = current) => {
    if (!window.confirm('Discard this blueprint PDF and its extracted curriculum?')) return;
    try {
      await deleteBlueprintImport(item.id);
    } catch (err) {
      setError(err.message);
      return;
    }
    setUnfinished((prev) => prev.filter((i) => i.id !== item.id));
    if (current?.id === item.id) reset();
  };

  const handleApplied = async (applied) => {
    reset();
    setNotice(`"${applied.programName}" is now your active curriculum. Subject priorities were rebuilt from its courses.`);
    await refresh();
    loadLists().catch(() => {});
  };

  const handleActivate = async (entry) => {
    const confirmed = window.confirm(
      `Switch your active curriculum to "${entry.programName}"?\n\n` +
      'Subjects, priorities and study focus will follow its courses (completion on same-named courses is kept).'
    );
    if (!confirmed) return;
    setError(null);
    setNotice(null);
    setSwitchingId(entry.id);
    try {
      await activateBlueprint(entry.id);
      await refresh();
      await loadLists();
      setNotice(`Switched to "${entry.programName}".`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSwitchingId(null);
    }
  };

  if (phase === 'review' && current) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <BlueprintReview blueprintImport={current} onApplied={handleApplied} onCancel={() => discard()} />
      </div>
    );
  }

  const busy = phase === 'uploading' || phase === 'extracting';
  const progress = current?.pageCount ? Math.round((current.pagesProcessed / current.pageCount) * 100) : 0;
  const foundSoFar = draftCourseCount(current?.draft);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Curriculum</h1>
        <p className="text-sm text-muted">
          Your subjects come from your program's official exit exam blueprint (the Ministry of Education document that
          lists themes, courses and how many exam items each one gets).
        </p>
      </div>

      {notice && (
        <div className="bg-green-500/10 border border-green-500 rounded-lg p-3 text-sm text-green-500" role="status">{notice}</div>
      )}

      {!loading && blueprint && <ActiveCurriculum blueprint={blueprint} />}

      {history.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-text">Blueprint history</h3>
          {history.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-text">
                {entry.programName}
                <span className="text-muted"> · {entry.courseCount} courses · {formatDate(entry.appliedAt)}</span>
              </span>
              {entry.isActive ? (
                <span className="text-xs font-semibold text-green-500">Active</span>
              ) : (
                <button
                  type="button"
                  className="text-primary-500 font-medium disabled:opacity-50"
                  onClick={() => handleActivate(entry)}
                  disabled={switchingId !== null}
                >
                  {switchingId === entry.id ? 'Switching…' : 'Make active'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {phase === 'select' && unfinished.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-text">Unfinished blueprint uploads</h3>
          {unfinished.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-text">
                {item.originalFilename}
                <span className="text-muted"> · {item.pagesProcessed}/{item.pageCount} pages · {item.status}</span>
              </span>
              <button type="button" className="text-primary-500 font-medium" onClick={() => resume(item)}>
                {item.status === 'ready' ? 'Review' : 'Continue'}
              </button>
              <button type="button" className="text-muted hover:text-red-400" onClick={() => discard(item)}>Discard</button>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-text">
          {blueprint ? 'Upload a new or updated blueprint' : 'Upload your exit exam blueprint'}
        </h3>
        {phase === 'select' && (
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); chooseFile(e.dataTransfer.files[0]); }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary-500 bg-primary-500/10' : 'border-border hover:border-primary-500'
              }`}
            >
              <p className="font-medium text-text">{file ? file.name : 'Drop the blueprint PDF here, or click to choose'}</p>
              <p className="text-xs text-muted mt-1">
                Any program. Scanned pages work. Up to {MAX_UPLOAD_MB} MB. You'll review everything before it's applied.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => chooseFile(e.target.files[0])}
              />
            </div>
            <button type="button" className="btn-primary w-full" onClick={handleUpload} disabled={!file}>
              Upload and extract curriculum
            </button>
          </>
        )}

        {busy && (
          <div className="space-y-3">
            <p className="font-medium text-text">
              {phase === 'uploading' || !current ? 'Uploading PDF…' : progressLabel(current)}
            </p>
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted">
              Each batch of pages can take a few minutes. You can leave this page; the upload keeps going and shows up
              under “Unfinished blueprint uploads”.
              {foundSoFar > 0 && ` ${foundSoFar} course(s) found so far.`}
            </p>
          </div>
        )}

        {phase === 'stopped' && current && (
          <div className="space-y-3">
            {current.status === 'ready' ? (
              <p className="text-text">No courses were found in this PDF. Is it the exit exam blueprint?</p>
            ) : (
              <p className="text-text">Stopped after {current.pagesProcessed} of {current.pageCount} pages.</p>
            )}
            <div className="flex flex-wrap gap-3">
              {current.status !== 'ready' && (
                <button type="button" className="btn-primary flex-1" onClick={() => runExtraction(current)}>
                  Retry extraction
                </button>
              )}
              {foundSoFar > 0 && (
                <button type="button" className="btn-secondary flex-1" onClick={() => setPhase('review')}>
                  Review {foundSoFar} course(s) found so far
                </button>
              )}
              <button type="button" className="btn-secondary flex-1" onClick={() => discard()}>Discard</button>
            </div>
          </div>
        )}

        {(error || (phase === 'stopped' && current?.error)) && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-400" role="alert">
            {error || current.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurriculumPage;
