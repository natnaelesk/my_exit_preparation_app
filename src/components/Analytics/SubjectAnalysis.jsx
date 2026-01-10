import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { calculateTopicStats } from '../../services/analyticsService';
import LoadingAnimation from '../Common/LoadingAnimation';
import PerformanceChart from './PerformanceChart';

const SubjectAnalysis = ({ subject, stats, onBack, onImproveTopic }) => {
  const [topicStats, setTopicStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const { startExam } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    loadTopicStats();
  }, [subject]);

  const loadTopicStats = async () => {
    try {
      setIsLoading(true);
      const stats = await calculateTopicStats(subject);
      setTopicStats(stats);
    } catch (error) {
      console.error('Error loading topic stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImproveTopic = async (topic) => {
    try {
      const topics = Object.keys(topicStats);
      await startExam('weak-area', { 
        subject,
        topics: [topic]
      });
      navigate('/exam');
    } catch (err) {
      console.error('Error starting topic improvement exam:', err);
    }
  };

  const topics = Object.values(topicStats).sort((a, b) => {
    return a.accuracy - b.accuracy;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'STRONG':
        return 'text-green-500 bg-green-500/10';
      case 'MEDIUM':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'WEAK':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-text-secondary bg-surface';
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button className="btn-secondary mb-4" onClick={onBack}>
            ← Back to All Subjects
          </button>
          <h2 className="text-2xl font-bold text-text">{subject}</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="card text-center">
            <div className="text-xs text-text-secondary mb-1 uppercase">Accuracy</div>
            <div className="text-xl font-bold text-text">
              {stats.totalAttempted > 0 ? `${stats.accuracy}%` : 'N/A'}
            </div>
          </div>
          <div className="card text-center">
            <div className="text-xs text-text-secondary mb-1 uppercase">Attempted</div>
            <div className="text-xl font-bold text-text">{stats.totalAttempted}</div>
          </div>
          <div className="card text-center">
            <div className="text-xs text-text-secondary mb-1 uppercase">Correct</div>
            <div className="text-xl font-bold text-text">{stats.correctCount || 0}</div>
          </div>
          <div className="card text-center">
            <div className="text-xs text-text-secondary mb-1 uppercase">Wrong</div>
            <div className="text-xl font-bold text-text">{stats.wrongCount || 0}</div>
          </div>
          <div className="card text-center">
            <div className="text-xs text-text-secondary mb-1 uppercase">Status</div>
            <div className={`text-xs px-2 py-1 rounded-full font-medium inline-block ${getStatusColor(stats.status)}`}>
              {stats.status}
            </div>
          </div>
        </div>

        {stats.trend && stats.trend.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-lg font-bold text-text mb-4">Performance Trend</h3>
            <PerformanceChart data={stats.trend} />
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold text-text mb-4">Topic-Level Analysis</h3>
          {isLoading ? (
            <div className="text-center py-8">
              <LoadingAnimation message="Loading topics" size="default" />
            </div>
          ) : topics.length === 0 ? (
            <div className="card text-center py-8 text-text-secondary">
              No topic data available. Attempt some questions in this subject to see topic-level analysis.
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((topic) => (
                <div key={topic.topic} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-text mb-2">{topic.topic}</div>
                      <div className="flex items-center gap-4 text-sm text-text-secondary">
                        <span>Accuracy: {topic.accuracy}%</span>
                        <span>Attempted: {topic.totalAttempted}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(topic.status)}`}>
                          {topic.status}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn-primary text-sm whitespace-nowrap ml-4"
                      onClick={() => handleImproveTopic(topic.topic)}
                    >
                      Improve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubjectAnalysis;
