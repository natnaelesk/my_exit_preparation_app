import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { getQuestionsBySubject } from '../../services/questionService';
import { OFFICIAL_SUBJECTS, EXAM_MODES } from '../../utils/constants';

const TopicFocusedMode = () => {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [availableTopics, setAvailableTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { startExam } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedSubject) {
      loadTopics();
    } else {
      setAvailableTopics([]);
      setSelectedTopics([]);
    }
  }, [selectedSubject]);

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      const questions = await getQuestionsBySubject(selectedSubject);
      const topics = [...new Set(questions.map(q => q.topic).filter(Boolean))];
      setAvailableTopics(topics.sort());
    } catch (error) {
      console.error('Error loading topics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopicToggle = (topic) => {
    setSelectedTopics(prev => {
      if (prev.includes(topic)) {
        return prev.filter(t => t !== topic);
      } else {
        return [...prev, topic];
      }
    });
  };

  const handleStartExam = async () => {
    if (!selectedSubject || selectedTopics.length === 0) {
      alert('Please select a subject and at least one topic');
      return;
    }

    try {
      await startExam(EXAM_MODES.TOPIC_FOCUSED, {
        subject: selectedSubject,
        topics: selectedTopics
      });
      navigate('/exam');
    } catch (error) {
      console.error('Error starting exam:', error);
      alert('Error starting exam: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-text mb-2">Topic-Focused Exam</h2>
        <p className="text-text-secondary text-sm mb-6">
          Select a subject and one or more topics to practice specific areas.
        </p>

        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Select Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input w-full"
            >
              <option value="">-- Select Subject --</option>
              {OFFICIAL_SUBJECTS.map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {selectedSubject && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Select Topics (select one or more)
              </label>
              {isLoading ? (
                <div className="text-text-secondary text-sm">Loading topics...</div>
              ) : availableTopics.length === 0 ? (
                <div className="text-text-secondary text-sm">No topics available for this subject</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableTopics.map(topic => (
                    <label
                      key={topic}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedTopics.includes(topic)
                          ? 'bg-primary-500/20 border-primary-500'
                          : 'bg-surface border-border hover:border-primary-500/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic)}
                        onChange={() => handleTopicToggle(topic)}
                        className="w-4 h-4 text-primary-500"
                      />
                      <span className="text-sm text-text">{topic}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              className="btn-primary flex-1"
              onClick={handleStartExam}
              disabled={!selectedSubject || selectedTopics.length === 0}
            >
              Start Topic-Focused Exam
            </button>
            <button
              className="btn-secondary flex-1"
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicFocusedMode;
