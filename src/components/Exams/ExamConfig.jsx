import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExamById } from '../../services/examService';
import { getQuestionsBySubject, getQuestionsByIds } from '../../services/questionService';
import { useExam } from '../../contexts/ExamContext';
import { EXAM_MODES } from '../../utils/constants';
import { SparklesIcon } from '@heroicons/react/24/outline';

const ExamConfig = ({ examId, onClose }) => {
  const [exam, setExam] = useState(null);
  const [mode, setMode] = useState(EXAM_MODES.RANDOM); // 'random', 'exam-weak-area', 'exam-subject-focused'
  const [questionCount, setQuestionCount] = useState(50);
  const [maxQuestions, setMaxQuestions] = useState(50);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [timePerQuestion, setTimePerQuestion] = useState(60); // seconds (1 minute)
  const [enableTimer, setEnableTimer] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { startExam } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    loadExam();
  }, [examId]);

  useEffect(() => {
    if (exam && exam.questionIds) {
      loadExamSubjects();
    }
  }, [exam]);

  const loadExam = async () => {
    try {
      setIsLoading(true);
      const examData = await getExamById(examId);
      setExam(examData);
      setMaxQuestions(examData.questionIds?.length || 50);
      setQuestionCount(Math.min(50, examData.questionIds?.length || 50));
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Error loading exam: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExamSubjects = async () => {
    try {
      const questions = await getQuestionsByIds(exam.questionIds);
      const subjects = [...new Set(questions.map(q => q.subject))];
      setAvailableSubjects(subjects.sort());
      if (subjects.length > 0 && !selectedSubject) {
        setSelectedSubject(subjects[0]);
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const handleStartExam = async () => {
    try {
      const config = {
        examId,
        questionCount: Math.min(questionCount, maxQuestions),
        timePerQuestion: enableTimer ? timePerQuestion : null
      };

      if (mode === 'exam-subject-focused') {
        if (!selectedSubject) {
          alert('Please select a subject for subject-focused mode');
          return;
        }
        config.subject = selectedSubject;
      }

      await startExam(mode, config);
      navigate('/exam');
    } catch (error) {
      console.error('Error starting exam:', error);
      alert('Error starting exam: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="card max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center py-8 text-text-secondary">Loading exam configuration...</div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="card max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-red-500 text-center py-8">Exam not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="card max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-text">Configure Exam</h2>
          <button className="text-text-secondary hover:text-text text-2xl" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="text-sm text-text-secondary mb-2">
          {exam.title}
        </div>
        <div className="text-xs text-text-secondary mb-6">
          {maxQuestions} questions available
        </div>

        {/* Exam Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text mb-3">
            Exam Mode
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-border cursor-pointer hover:border-primary-500/50 transition-all">
              <input
                type="radio"
                name="mode"
                value={EXAM_MODES.RANDOM}
                checked={mode === EXAM_MODES.RANDOM}
                onChange={(e) => setMode(e.target.value)}
                className="w-4 h-4 text-primary-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-text">Random Mode</div>
                <div className="text-xs text-text-secondary">Random questions from this exam</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary-500/50 bg-primary-500/10 cursor-pointer transition-all">
              <input
                type="radio"
                name="mode"
                value="exam-weak-area"
                checked={mode === 'exam-weak-area'}
                onChange={(e) => setMode(e.target.value)}
                className="w-4 h-4 text-primary-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-text flex items-center gap-2">Weak Area Mode <SparklesIcon className="w-4 h-4 text-primary-500" /></div>
                <div className="text-xs text-text-secondary">Focus on your weak topics from this exam only</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-border cursor-pointer hover:border-primary-500/50 transition-all">
              <input
                type="radio"
                name="mode"
                value="exam-subject-focused"
                checked={mode === 'exam-subject-focused'}
                onChange={(e) => setMode(e.target.value)}
                className="w-4 h-4 text-primary-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-text">Subject-Focused Mode</div>
                <div className="text-xs text-text-secondary">Practice specific subject from this exam</div>
              </div>
            </label>
          </div>
        </div>

        {/* Subject Selection (for subject-focused mode) */}
        {mode === 'exam-subject-focused' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-text mb-2">
              Select Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input w-full"
            >
              <option value="">-- Select Subject --</option>
              {availableSubjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Question Count Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text mb-2">
            Number of Questions: {questionCount} / {maxQuestions}
          </label>
          <input
            type="range"
            min="1"
            max={maxQuestions}
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value))}
            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
          <div className="flex justify-between text-xs text-text-secondary mt-1">
            <span>1</span>
            <span>{maxQuestions}</span>
          </div>
        </div>

        {/* Timer Settings */}
        <div className="mb-6">
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enableTimer}
              onChange={(e) => setEnableTimer(e.target.checked)}
              className="w-4 h-4 text-primary-500 rounded"
            />
            <span className="text-sm font-medium text-text">Enable Timer</span>
          </label>
          
          {enableTimer && (
            <div className="ml-7">
              <label className="block text-xs text-text-secondary mb-2">
                Time per Question (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                step="10"
                value={timePerQuestion}
                onChange={(e) => setTimePerQuestion(Math.max(10, parseInt(e.target.value) || 60))}
                className="input w-full"
              />
              <div className="text-xs text-text-secondary mt-1">
                {Math.floor(timePerQuestion / 60)}m {timePerQuestion % 60}s per question
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            className="btn-secondary flex-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            onClick={handleStartExam}
            disabled={mode === 'exam-subject-focused' && !selectedSubject}
          >
            Start Exam
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamConfig;

