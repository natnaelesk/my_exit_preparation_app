import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../services/apiClient';
import {
  uploadExamPdf,
  startExtraction,
  waitForExtraction,
  deleteExamImport,
} from '../../services/examImportService';
import ExamImportReview from './ExamImportReview';

const MAX_UPLOAD_MB = 25;

const progressLabel = (examImport) => {
  const first = examImport.pagesProcessed + 1;
  const last = Math.min(examImport.pagesProcessed + examImport.pagesPerBatch, examImport.pageCount);
  return first === last
    ? `Reading page ${first} of ${examImport.pageCount}…`
    : `Reading pages ${first}–${last} of ${examImport.pageCount}…`;
};

const PdfImport = () => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState('select'); // select | uploading | extracting | stopped | review | published
  const [examImport, setExamImport] = useState(null);
  const [publishedExam, setPublishedExam] = useState(null);
  const [error, setError] = useState(null);
  const [unfinished, setUnfinished] = useState([]);
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    get('/exam-imports/')
      .then((response) => {
        const imports = response.results || response;
        if (!cancelledRef.current) setUnfinished(imports.filter((i) => i.status !== 'published'));
      })
      .catch(() => {});
    return () => { cancelledRef.current = true; };
  }, []);

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

  const followExtraction = async (current) => {
    setExamImport(current);
    setPhase('extracting');
    const final = await waitForExtraction(current.id, {
      onUpdate: setExamImport,
      isCancelled: () => cancelledRef.current,
    });
    if (cancelledRef.current) return;
    setExamImport(final);
    if (final.status === 'ready' && final.questions.length > 0) {
      setPhase('review');
    } else {
      setPhase('stopped');
    }
  };

  const runExtraction = async (current) => {
    setError(null);
    try {
      let started = current;
      try {
        started = await startExtraction(current.id);
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
    setPhase('uploading');
    try {
      const created = await uploadExamPdf(file, title.trim());
      setExamImport(created);
      await runExtraction(created);
    } catch (err) {
      setError(err.message);
      setPhase('select');
    }
  };

  const resume = (item) => {
    setUnfinished((prev) => prev.filter((i) => i.id !== item.id));
    if (item.status === 'ready' && item.questions.length > 0) {
      setExamImport(item);
      setPhase('review');
    } else if (item.status === 'extracting') {
      followExtraction(item).catch((err) => { setError(err.message); setPhase('stopped'); });
    } else {
      setExamImport(item);
      runExtraction(item);
    }
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setExamImport(null);
    setPublishedExam(null);
    setError(null);
    setPhase('select');
  };

  const discard = async (item = examImport) => {
    if (!window.confirm('Discard this PDF and its extracted questions?')) return;
    try {
      await deleteExamImport(item.id);
    } catch (err) {
      setError(err.message);
      return;
    }
    setUnfinished((prev) => prev.filter((i) => i.id !== item.id));
    if (examImport?.id === item.id) reset();
  };

  if (phase === 'review' && examImport) {
    return (
      <ExamImportReview
        examImport={examImport}
        onPublished={(exam) => { setPublishedExam(exam); setPhase('published'); }}
        onCancel={() => discard()}
      />
    );
  }

  if (phase === 'published' && publishedExam) {
    return (
      <div className="card space-y-3">
        <h3 className="text-green-500 font-bold">Exam published!</h3>
        <p className="text-sm text-text">
          “{publishedExam.title}” is saved with {publishedExam.questionIds.length} questions.
        </p>
        <div className="flex gap-3">
          <Link to={`/exams/${publishedExam.examId}`} className="btn-primary flex-1 text-center">Open exam</Link>
          <button type="button" className="btn-secondary flex-1" onClick={reset}>Import another PDF</button>
        </div>
      </div>
    );
  }

  const busy = phase === 'uploading' || phase === 'extracting';
  const progress = examImport?.pageCount ? Math.round((examImport.pagesProcessed / examImport.pageCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {phase === 'select' && unfinished.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-text">Unfinished imports</h3>
          {unfinished.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-text">
                {item.title || item.originalFilename}
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
              <p className="font-medium text-text">{file ? file.name : 'Drop an exam PDF here, or click to choose'}</p>
              <p className="text-xs text-muted mt-1">
                Photo or scanned pages work. Up to {MAX_UPLOAD_MB} MB. You'll review every question before it's saved.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => chooseFile(e.target.files[0])}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2" htmlFor="pdf-exam-title">
                Exam title (optional)
              </label>
              <input
                id="pdf-exam-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Taken from the PDF if left empty"
              />
            </div>

            <button type="button" className="btn-primary w-full" onClick={handleUpload} disabled={!file}>
              Upload and extract questions
            </button>
          </>
        )}

        {busy && (
          <div className="space-y-3">
            <p className="font-medium text-text">
              {phase === 'uploading' || !examImport ? 'Uploading PDF…' : progressLabel(examImport)}
            </p>
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted">
              Each batch of pages can take up to a minute. You can leave this page; the import keeps going and shows up
              under “Unfinished imports”.
              {examImport?.questions?.length > 0 && ` ${examImport.questions.length} question(s) found so far.`}
            </p>
          </div>
        )}

        {phase === 'stopped' && examImport && (
          <div className="space-y-3">
            {examImport.status === 'ready' ? (
              <p className="text-text">No questions were found in this PDF.</p>
            ) : (
              <p className="text-text">
                Stopped after {examImport.pagesProcessed} of {examImport.pageCount} pages.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {examImport.status !== 'ready' && (
                <button type="button" className="btn-primary flex-1" onClick={() => runExtraction(examImport)}>
                  Retry extraction
                </button>
              )}
              {examImport.questions.length > 0 && (
                <button type="button" className="btn-secondary flex-1" onClick={() => setPhase('review')}>
                  Review {examImport.questions.length} question(s) found so far
                </button>
              )}
              <button type="button" className="btn-secondary flex-1" onClick={() => discard()}>
                Discard
              </button>
            </div>
          </div>
        )}

        {(error || (phase === 'stopped' && examImport?.error)) && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-400" role="alert">
            {error || examImport.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfImport;
