import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { calculateSubjectStats, calculateTopicStats, calculateOverallTrend } from '../../services/analyticsService';
import { OFFICIAL_SUBJECTS } from '../../utils/constants';
import LoadingAnimation from '../Common/LoadingAnimation';
import ButtonLoading from '../Common/ButtonLoading';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { getStatusColor, getStatusLabel } from '../../utils/statusHelpers';

const AnalyticsDashboard = () => {
  const [subjectStats, setSubjectStats] = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [topicStats, setTopicStats] = useState({});
  const [overallTrend, setOverallTrend] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImproving, setIsImproving] = useState(false);
  const [improvingSubject, setImprovingSubject] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { startExam } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadTopicStats(selectedSubject);
    }
  }, [selectedSubject]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const stats = await calculateSubjectStats();
      setSubjectStats(stats);
      
      // Load overall trend
      const trend = await calculateOverallTrend();
      setOverallTrend(trend);
      
      // Don't auto-select subject - let graph show overall by default
      // User can click on a subject to see its specific trend
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTopicStats = async (subject) => {
    try {
      const stats = await calculateTopicStats(subject);
      setTopicStats(stats);
    } catch (error) {
      console.error('Error loading topic stats:', error);
      setTopicStats({});
    }
  };

  const handleImproveSubject = async (subject) => {
    try {
      setIsImproving(true);
      setImprovingSubject(subject);
      await startExam('weak-area', { subject });
      // Don't reset state here - navigation will unmount component
      // Keep loading state visible during navigation transition
      navigate('/exam');
    } catch (err) {
      console.error('Error starting improvement exam:', err);
      alert('Error starting improvement exam: ' + err.message);
      // Only reset state on error (navigation didn't happen)
      setIsImproving(false);
      setImprovingSubject(null);
    }
  };

  // Use status helper for colors - keeping local function for backward compatibility
  const getStatusColorLocal = (status) => {
    const colors = getStatusColor(status);
    return { primary: colors.primary, bg: colors.bg, border: colors.border };
  };

  // Get status priority for sorting (lower number = higher priority/better)
  const getStatusPriority = (status) => {
    const priorityMap = {
      'EXCELLENT': 1,
      'VERY_GOOD': 2,
      'GOOD': 3,
      'MODERATE': 4,
      'NEED_IMPROVEMENT': 5,
      'NEED_IMPROVEMENT_VERY_MUCH': 6,
      'DEAD_ZONE': 7,
      'N/A': 8
    };
    return priorityMap[status] || 9;
  };

  // Sort subjects by status (Excellent to Dead Zone), then by accuracy within same status
  const sortedSubjects = [...OFFICIAL_SUBJECTS].sort((a, b) => {
    const statsA = subjectStats[a] || { status: 'N/A', accuracy: 0, totalAttempted: 0 };
    const statsB = subjectStats[b] || { status: 'N/A', accuracy: 0, totalAttempted: 0 };
    
    const priorityA = getStatusPriority(statsA.status);
    const priorityB = getStatusPriority(statsB.status);
    
    // First sort by status priority
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // If same status, sort by accuracy (higher first)
    return (statsB.accuracy || 0) - (statsA.accuracy || 0);
  });

  // Calculate overall statistics
  const overallStats = Object.values(subjectStats).reduce((acc, stat) => {
    if (stat && stat.totalAttempted > 0) {
      acc.totalAttempted += stat.totalAttempted || 0;
      acc.totalCorrect += stat.correctCount || 0;
      acc.totalWrong += stat.wrongCount || 0;
    }
    return acc;
  }, { totalAttempted: 0, totalCorrect: 0, totalWrong: 0 });

  const overallAccuracy = overallStats.totalAttempted > 0 
    ? (overallStats.totalCorrect / overallStats.totalAttempted) * 100 
    : 0;

  const subjectsWithData = Object.values(subjectStats).filter(s => s && s.totalAttempted > 0);
  const excellentCount = subjectsWithData.filter(s => s.status === 'EXCELLENT').length;
  const veryGoodCount = subjectsWithData.filter(s => s.status === 'VERY_GOOD').length;
  const goodCount = subjectsWithData.filter(s => s.status === 'GOOD').length;
  const moderateCount = subjectsWithData.filter(s => s.status === 'MODERATE').length;
  const needImprovementCount = subjectsWithData.filter(s => s.status === 'NEED_IMPROVEMENT').length;
  const needImprovementVeryMuchCount = subjectsWithData.filter(s => s.status === 'NEED_IMPROVEMENT_VERY_MUCH').length;
  const deadZoneCount = subjectsWithData.filter(s => s.status === 'DEAD_ZONE').length;

  // Prepare chart data - with validation to prevent NaN
  const performanceData = Object.values(subjectStats)
    .filter(s => s && s.totalAttempted > 0 && !isNaN(s.accuracy) && isFinite(s.accuracy))
    .sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0))
    .slice(0, 10)
    .map(s => ({
      name: s.subject && s.subject.length > (isMobile ? 12 : 20) 
        ? s.subject.substring(0, isMobile ? 12 : 20) + '...' 
        : s.subject || 'Unknown',
      accuracy: Math.round(s.accuracy || 0),
      attempted: s.totalAttempted || 0,
      status: s.status || 'N/A'
    }));

  const statusDistribution = [
    { name: 'Excellent', value: excellentCount, color: '#fbbf24' },
    { name: 'Very Good', value: veryGoodCount, color: '#10b981' },
    { name: 'Good', value: goodCount, color: '#22c55e' },
    { name: 'Moderate', value: moderateCount, color: '#f59e0b' },
    { name: 'Need Improvement', value: needImprovementCount, color: '#f97316' },
    { name: 'Need Improvement Very Much', value: needImprovementVeryMuchCount, color: '#ef4444' },
    { name: 'Dead Zone', value: deadZoneCount, color: '#dc2626' },
    { name: 'Not Started', value: Math.max(0, 15 - subjectsWithData.length), color: '#6b7280' }
  ].filter(item => item.value > 0);

  const currentSubject = selectedSubject && subjectStats[selectedSubject] ? subjectStats[selectedSubject] : {
    subject: selectedSubject || 'None',
    totalAttempted: 0,
    accuracy: 0,
    correctCount: 0,
    wrongCount: 0,
    status: 'N/A',
    trend: []
  };

  // Format subject trend data to match overall trend format
  const formatSubjectTrend = (trend) => {
    if (!trend || !Array.isArray(trend) || trend.length === 0) return [];
    
    let cumulativeCorrect = 0;
    let cumulativeTotal = 0;
    
    return trend.map((item) => {
      // Parse the date string (e.g., "Mon Jan 09 2024" or Date object)
      let date;
      if (item.date instanceof Date) {
        date = item.date;
      } else if (typeof item.date === 'string') {
        date = new Date(item.date);
        // If the date string is invalid, try parsing as ISO string
        if (isNaN(date.getTime())) {
          // Try parsing as ISO string (YYYY-MM-DD)
          const isoMatch = item.date.match(/^\d{4}-\d{2}-\d{2}/);
          if (isoMatch) {
            date = new Date(isoMatch[0]);
          } else {
            return null; // Skip invalid dates
          }
        }
      } else {
        return null; // Skip invalid entries
      }
      
      if (isNaN(date.getTime())) {
        return null; // Skip invalid dates
      }
      
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // For subject trends, calculate cumulative accuracy
      // Estimate questions per day based on accuracy trend
      const dailyAccuracy = item.accuracy || 0;
      const estimatedDailyQuestions = 10; // Estimate: assume 10 questions per day
      cumulativeTotal += estimatedDailyQuestions;
      cumulativeCorrect += (dailyAccuracy / 100) * estimatedDailyQuestions;
      
      const cumulativeAccuracy = cumulativeTotal > 0 
        ? (cumulativeCorrect / cumulativeTotal) * 100 
        : dailyAccuracy;

      return {
        date: dateKey,
        dateDisplay: format(date, 'MMM dd'),
        accuracy: Math.round(cumulativeAccuracy * 100) / 100,
        correct: Math.round(cumulativeCorrect),
        total: Math.round(cumulativeTotal)
      };
    }).filter(item => item !== null); // Remove invalid entries
  };

  // Get the trend data to display - overall or subject-specific
  // Show subject-specific trend only if subject is selected AND has trend data
  // Otherwise show overall trend
  const showSubjectTrend = selectedSubject && currentSubject?.trend && Array.isArray(currentSubject.trend) && currentSubject.trend.length > 0;
  const displayTrend = showSubjectTrend
    ? formatSubjectTrend(currentSubject.trend)
    : overallTrend;

  // Get the title and current accuracy for the graph
  const graphTitle = showSubjectTrend
    ? `${selectedSubject} Accuracy Over Time`
    : 'Your Overall Accuracy Over Time';
  
  const graphSubtitle = showSubjectTrend
    ? `See your performance in ${selectedSubject}`
    : 'See how your performance improves day by day';

  const graphCurrentAccuracy = showSubjectTrend
    ? currentSubject.accuracy
    : overallAccuracy;
  
  // Ensure graphLabel is always defined
  const graphLabel = showSubjectTrend && selectedSubject ? selectedSubject : 'Overall';

  const topics = Object.values(topicStats).filter(t => t && !isNaN(t.accuracy)).sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));
  const topicChartData = topics.slice(0, 8).map(t => ({
    name: t.topic && t.topic.length > 15 ? t.topic.substring(0, 15) + '...' : (t.topic || 'Unknown'),
    accuracy: Math.round(t.accuracy || 0),
    attempted: t.totalAttempted || 0
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center pb-20 md:pb-6">
        <LoadingAnimation message="Crunching your analytics" size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text pb-20 md:pb-6">
      {/* Header - Mobile Optimized */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text">Performance Analytics</h1>
            <p className="text-xs md:text-sm text-muted mt-0.5">Your exam performance insights</p>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Single Column */}
      {isMobile ? (
        <div className="px-4 py-4 space-y-4">
          {/* Overview Stats - Mobile Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/10 rounded-xl p-4 border border-primary-500/30">
              <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Overall Accuracy</div>
              <div className="text-2xl font-bold text-primary-500 mb-1">{Math.round(overallAccuracy)}%</div>
              <div className="text-xs text-text-secondary">{overallStats.totalAttempted} attempted</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
              <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Correct</div>
              <div className="text-2xl font-bold text-green-500 mb-1">{overallStats.totalCorrect}</div>
              <div className="text-xs text-text-secondary">{Math.round((overallStats.totalCorrect / Math.max(overallStats.totalAttempted, 1)) * 100)}% rate</div>
            </div>
            <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl p-4 border border-red-500/30">
              <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Wrong</div>
              <div className="text-2xl font-bold text-red-500 mb-1">{overallStats.totalWrong}</div>
              <div className="text-xs text-text-secondary">Needs attention</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-4 border border-yellow-500/30">
              <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Excellent</div>
              <div className="text-2xl font-bold text-yellow-500 mb-1">{excellentCount}</div>
              <div className="text-xs text-text-secondary">{subjectsWithData.length} subjects</div>
            </div>
          </div>

          {/* Big Accuracy Trend Graph - Mobile */}
          {displayTrend.length > 0 && (
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-text mb-1">{graphTitle}</h3>
                  <p className="text-xs text-text-secondary">{graphSubtitle}</p>
                </div>
                <div className="text-right ml-4">
                  <div className="text-xl font-bold text-primary-500">{Math.round(graphCurrentAccuracy)}%</div>
                  <div className="text-xs text-text-secondary">{graphLabel}</div>
                </div>
              </div>
              <div className="w-full mt-4" style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={displayTrend.map(item => ({
                      ...item,
                      accuracy: isNaN(item.accuracy) || !isFinite(item.accuracy) ? 0 : Math.max(0, Math.min(100, item.accuracy))
                    }))} 
                    margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
                  >
                    <defs>
                      <linearGradient id="colorAccuracyMobile" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="dateDisplay" 
                      stroke="#a3a3a3"
                      style={{ fontSize: '10px' }}
                      angle={-45}
                      textAnchor="end"
                      height={70}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="#a3a3a3"
                      style={{ fontSize: '11px' }}
                      tickFormatter={(value) => `${value}%`}
                      width={40}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a', 
                        border: '1px solid #333', 
                        borderRadius: '8px',
                        color: '#f5f5f5',
                        fontSize: '11px'
                      }}
                      formatter={(value) => {
                        const val = isNaN(value) ? 0 : Math.round(value);
                        return [`${val}%`, 'Accuracy'];
                      }}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorAccuracyMobile)"
                      dot={{ r: 3, fill: '#f97316', strokeWidth: 1, stroke: '#fff' }}
                      activeDot={{ r: 5, fill: '#ea580c', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {displayTrend.length > 1 && (
                <div className="mt-3 flex items-center justify-between text-xs text-text-secondary pt-3 border-t border-border">
                  <span>Start: {displayTrend[0]?.dateDisplay || 'N/A'}</span>
                  <span>Latest: {displayTrend[displayTrend.length - 1]?.dateDisplay || 'N/A'}</span>
                  <span>{displayTrend.length} points</span>
                </div>
              )}
            </div>
          )}

          {/* Subject List - Mobile Optimized */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-text px-2">All Subjects</h2>
            {sortedSubjects.map((subject) => {
              const stats = subjectStats[subject] || {
                subject,
                totalAttempted: 0,
                accuracy: 0,
                correctCount: 0,
                wrongCount: 0,
                status: 'N/A'
              };
              
              const colors = getStatusColor(stats.status);
              const statusLabel = getStatusLabel(stats.status);
              const isSelected = selectedSubject === subject;
              const progressPercent = stats.totalAttempted > 0 
                ? ((stats.correctCount || 0) / stats.totalAttempted) * 100 
                : 0;
              const isExcellent = stats.status === 'EXCELLENT';
              const isDeadZone = stats.status === 'DEAD_ZONE';

              return (
                <div
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? `border-primary-500 bg-primary-500/10` 
                      : isExcellent
                      ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/40 hover:border-yellow-500/60'
                      : isDeadZone
                      ? 'bg-red-600/15 border-red-600/40 hover:border-red-600/60'
                      : `${colors.borderClass} ${colors.bgClass} hover:border-primary-500/50`
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-text flex-1 leading-tight pr-2">
                      {subject}
                      {isDeadZone && <span className="ml-2 text-base">☠️</span>}
                    </h3>
                    <span 
                      className="text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap"
                      style={{
                        backgroundColor: `${colors.primary}20`,
                        color: colors.primary,
                        border: `1px solid ${colors.border}`
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {stats.totalAttempted > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl font-bold text-text">
                          {Math.round(stats.accuracy)}%
                        </span>
                        <span className="text-xs text-text-secondary">
                          {stats.correctCount || 0} / {stats.totalAttempted}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-bg rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full transition-all duration-300 rounded-full"
                          style={{ 
                            width: `${progressPercent}%`,
                            backgroundColor: colors.primary
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-500 font-semibold flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> {stats.correctCount || 0}</span>
                        <span className="text-red-500 font-semibold flex items-center gap-1"><XCircleIcon className="w-3 h-3" /> {stats.wrongCount || 0}</span>
                      </div>
                      {(stats.status === 'DEAD_ZONE' || stats.status === 'NEED_IMPROVEMENT_VERY_MUCH' || stats.status === 'NEED_IMPROVEMENT') && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            {stats.status === 'DEAD_ZONE' && <span className="text-base">☠️</span>}
                            <ExclamationTriangleIcon className="w-3 h-3" /> 
                            {stats.status === 'DEAD_ZONE' ? 'Dead Zone - Critical improvement needed' :
                             stats.status === 'NEED_IMPROVEMENT_VERY_MUCH' ? 'Needs improvement very much' :
                             'Needs improvement'}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-text-secondary py-2">
                      Not attempted yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Subject Details - Mobile */}
          {selectedSubject && currentSubject && (
            <div className="bg-card rounded-xl p-4 border border-border mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text">{selectedSubject}</h3>
                {currentSubject.totalAttempted > 0 && (
                  <button
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-2"
                    onClick={() => handleImproveSubject(selectedSubject)}
                    disabled={isImproving}
                  >
                    {isImproving && improvingSubject === selectedSubject ? (
                      <ButtonLoading text="Loading..." />
                    ) : (
                      'Improve'
                    )}
                  </button>
                )}
              </div>

              {currentSubject.totalAttempted > 0 ? (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-surface rounded-lg p-3 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Accuracy</div>
                      <div className="text-lg font-bold" style={{ color: getStatusColor(currentSubject.status).primary }}>
                        {Math.round(currentSubject.accuracy)}%
                      </div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Total</div>
                      <div className="text-lg font-bold text-text">{currentSubject.totalAttempted}</div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Correct</div>
                      <div className="text-lg font-bold text-green-500">{currentSubject.correctCount || 0}</div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Wrong</div>
                      <div className="text-lg font-bold text-red-500">{currentSubject.wrongCount || 0}</div>
                    </div>
                  </div>

                  {/* Topics - Mobile List */}
                  {topics.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-text mb-3">Topics</h4>
                      <div className="space-y-2">
                        {topics.slice(0, 5).map((topic) => {
                          const topicColors = getStatusColor(topic.status);
                          return (
                            <div key={topic.topic} className="bg-surface rounded-lg p-3 border border-border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-text">{topic.topic}</span>
                                <span 
                                  className="text-xs px-2 py-0.5 rounded-full font-bold"
                                  style={{
                                    backgroundColor: `${topicColors.primary}20`,
                                    color: topicColors.primary
                                  }}
                                >
                                  {topic.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-text-secondary">Accuracy: {Math.round(topic.accuracy)}%</span>
                                <span className="text-xs text-text-secondary">{topic.totalAttempted} questions</span>
                              </div>
                              <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden mt-2">
                                <div 
                                  className="h-full rounded-full transition-all"
                                  style={{ 
                                    width: `${Math.min(100, Math.max(0, topic.accuracy || 0))}%`,
                                    backgroundColor: topicColors.primary
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-text-secondary text-sm">
                  No data available. Start practicing to see insights!
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Desktop Layout - Split Screen */
        <div className="flex h-[calc(100vh-80px)] overflow-hidden">
          {/* Left Side - Main Analytics (70%) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/10 rounded-xl p-4 border border-primary-500/30">
                <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Overall Accuracy</div>
                <div className="text-3xl font-bold text-primary-500 mb-1">{Math.round(overallAccuracy)}%</div>
                <div className="text-xs text-text-secondary">{overallStats.totalAttempted} questions attempted</div>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
                <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Correct Answers</div>
                <div className="text-3xl font-bold text-green-500 mb-1">{overallStats.totalCorrect}</div>
                <div className="text-xs text-text-secondary">{Math.round((overallStats.totalCorrect / Math.max(overallStats.totalAttempted, 1)) * 100)}% success rate</div>
              </div>
              <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl p-4 border border-red-500/30">
                <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Wrong Answers</div>
                <div className="text-3xl font-bold text-red-500 mb-1">{overallStats.totalWrong}</div>
                <div className="text-xs text-text-secondary">Requires attention</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-4 border border-yellow-500/30">
                <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Excellent</div>
                <div className="text-3xl font-bold text-yellow-500 mb-1">{excellentCount}</div>
                <div className="text-xs text-text-secondary">Out of {subjectsWithData.length} attempted</div>
              </div>
            </div>

            {/* Big Accuracy Trend Graph - Desktop */}
            {displayTrend.length > 0 && (
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-text mb-1">{graphTitle}</h3>
                    <p className="text-sm text-text-secondary">{graphSubtitle}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary-500">{Math.round(graphCurrentAccuracy)}%</div>
                    <div className="text-xs text-text-secondary">Current {graphLabel}</div>
                    {showSubjectTrend && (
                      <button
                        className="mt-2 text-xs text-primary-500 hover:text-primary-400 underline"
                        onClick={() => setSelectedSubject(null)}
                      >
                        Show Overall
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full" style={{ height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={displayTrend.map(item => ({
                        ...item,
                        accuracy: isNaN(item.accuracy) || !isFinite(item.accuracy) ? 0 : Math.max(0, Math.min(100, item.accuracy))
                      }))} 
                      margin={{ top: 10, right: 30, left: 0, bottom: 50 }}
                    >
                    <defs>
                      <linearGradient id="colorAccuracyDesktop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.5}/>
                        <stop offset="50%" stopColor="#f97316" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="dateDisplay" 
                      stroke="#a3a3a3"
                      style={{ fontSize: '12px' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="#a3a3a3"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `${value}%`}
                      label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', style: { fill: '#a3a3a3', fontSize: '12px' } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a', 
                        border: '1px solid #333', 
                        borderRadius: '8px',
                        color: '#f5f5f5',
                        fontSize: '13px'
                      }}
                      formatter={(value, name, props) => {
                        const val = isNaN(value) ? 0 : Math.round(value);
                        return [`${val}%`, 'Accuracy', `(${props.payload?.total || 0} questions)`];
                      }}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                      <Area 
                        type="monotone" 
                        dataKey="accuracy" 
                        stroke="#f97316" 
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorAccuracyDesktop)"
                        dot={{ r: 5, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8, fill: '#ea580c', strokeWidth: 2, stroke: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {displayTrend.length > 1 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-text-secondary pt-3 border-t border-border">
                    <span>Started: {displayTrend[0]?.dateDisplay || 'N/A'}</span>
                    <span>Latest: {displayTrend[displayTrend.length - 1]?.dateDisplay || 'N/A'}</span>
                    <span>{displayTrend.length} data points</span>
                  </div>
                )}
              </div>
            )}

          {/* Selected Subject Details - Desktop */}
            {selectedSubject && currentSubject && (
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-text">{selectedSubject} - Detailed Analysis</h3>
                  {currentSubject.totalAttempted > 0 && (
                    <button
                      className="btn-primary text-sm flex items-center gap-2"
                      onClick={() => handleImproveSubject(selectedSubject)}
                      disabled={isImproving}
                    >
                      {isImproving && improvingSubject === selectedSubject ? (
                        <ButtonLoading text="Preparing Questions..." />
                      ) : (
                        'Improve This Area'
                      )}
                    </button>
                  )}
                </div>

                {currentSubject.totalAttempted > 0 ? (
                  <>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-surface rounded-lg p-4 border border-border text-center">
                        <div className="text-xs text-text-secondary mb-1">Accuracy</div>
                        <div className="text-2xl font-bold" style={{ color: getStatusColor(currentSubject.status).primary }}>
                          {Math.round(currentSubject.accuracy)}%
                        </div>
                      </div>
                      <div className="bg-surface rounded-lg p-4 border border-border text-center">
                        <div className="text-xs text-text-secondary mb-1">Attempted</div>
                        <div className="text-2xl font-bold text-text">{currentSubject.totalAttempted}</div>
                      </div>
                      <div className="bg-surface rounded-lg p-4 border border-border text-center">
                        <div className="text-xs text-text-secondary mb-1">Correct</div>
                        <div className="text-2xl font-bold text-green-500">{currentSubject.correctCount || 0}</div>
                      </div>
                      <div className="bg-surface rounded-lg p-4 border border-border text-center">
                        <div className="text-xs text-text-secondary mb-1">Wrong</div>
                        <div className="text-2xl font-bold text-red-500">{currentSubject.wrongCount || 0}</div>
                      </div>
                    </div>

                    {/* Topic Performance - Desktop Grid */}
                    {topics.length > 0 && (
                      <div>
                        <h4 className="text-base font-semibold text-text mb-3">Topic-Level Performance</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {topics.slice(0, 8).map((topic) => {
                            const topicColors = getStatusColor(topic.status);
                            const topicAccuracy = Math.min(100, Math.max(0, topic.accuracy || 0));
                            return (
                              <div key={topic.topic} className={`p-4 rounded-lg border ${topicColors.bg}`} style={{ borderColor: topicColors.border }}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-semibold text-text">{topic.topic}</span>
                                  <span 
                                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                                    style={{
                                      backgroundColor: `${topicColors.primary}20`,
                                      color: topicColors.primary
                                    }}
                                  >
                                    {topic.status}
                                  </span>
                                </div>
                                <div className="text-xl font-bold mb-1" style={{ color: topicColors.primary }}>
                                  {Math.round(topic.accuracy)}%
                                </div>
                                <div className="text-xs text-text-secondary mb-2">
                                  {topic.correctCount || 0} / {topic.totalAttempted} correct
                                </div>
                                <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all"
                                    style={{ 
                                      width: `${topicAccuracy}%`,
                                      backgroundColor: topicColors.primary
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    No data available for this subject yet. Start practicing to see detailed insights!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side - Subject List (30%) */}
          <div className="w-80 border-l border-border bg-card overflow-y-auto">
            <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-lg font-bold text-text mb-1">All Subjects</h2>
              <p className="text-xs text-text-secondary">{subjectsWithData.length} / 15 attempted</p>
            </div>
            
            <div className="p-2 space-y-2">
              {sortedSubjects.map((subject) => {
                const stats = subjectStats[subject] || {
                  subject,
                  totalAttempted: 0,
                  accuracy: 0,
                  correctCount: 0,
                  wrongCount: 0,
                  status: 'N/A'
                };
                
                const colors = getStatusColor(stats.status);
                const statusLabel = getStatusLabel(stats.status);
                const isSelected = selectedSubject === subject;
                const progressPercent = stats.totalAttempted > 0 
                  ? ((stats.correctCount || 0) / stats.totalAttempted) * 100 
                  : 0;
                const isExcellent = stats.status === 'EXCELLENT';
                const isDeadZone = stats.status === 'DEAD_ZONE';

                return (
                  <div
                    key={subject}
                    onClick={() => setSelectedSubject(subject)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-primary-500 bg-primary-500/10' 
                        : isExcellent
                        ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/40 hover:border-yellow-500/60'
                        : isDeadZone
                        ? 'bg-red-600/15 border-red-600/40 hover:border-red-600/60'
                        : `${colors.borderClass} ${colors.bgClass} hover:border-primary-500/50`
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-text flex-1 leading-tight">
                        {subject}
                        {isDeadZone && <span className="ml-2 text-base">☠️</span>}
                      </h3>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap ml-2"
                        style={{
                          backgroundColor: `${colors.primary}20`,
                          color: colors.primary,
                          border: `1px solid ${colors.border}`
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {stats.totalAttempted > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg font-bold text-text">
                            {Math.round(stats.accuracy)}%
                          </span>
                          <span className="text-xs text-text-secondary">
                            {stats.correctCount || 0} / {stats.totalAttempted}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-bg rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full transition-all duration-300 rounded-full"
                            style={{ 
                              width: `${progressPercent}%`,
                              backgroundColor: colors.primary
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-text-secondary">Correct:</span>
                            <span className="font-semibold text-green-500 ml-1">{stats.correctCount || 0}</span>
                          </div>
                          <div>
                            <span className="text-text-secondary">Wrong:</span>
                            <span className="font-semibold text-red-500 ml-1">{stats.wrongCount || 0}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-text-secondary py-2">
                        Not attempted yet
                      </div>
                    )}

                    {stats.totalAttempted > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        {stats.status === 'EXCELLENT' && (
                          <div className="text-xs text-yellow-400 font-semibold">
                            ⭐ Excellent performance
                          </div>
                        )}
                        {stats.status === 'VERY_GOOD' && (
                          <div className="text-xs text-green-400">
                            ✅ Very good performance
                          </div>
                        )}
                        {stats.status === 'GOOD' && (
                          <div className="text-xs text-green-300">
                            ✓ Good performance
                          </div>
                        )}
                        {stats.status === 'MODERATE' && (
                          <div className="text-xs text-yellow-400">
                            💡 Moderate - room for improvement
                          </div>
                        )}
                        {(stats.status === 'NEED_IMPROVEMENT' || stats.status === 'NEED_IMPROVEMENT_VERY_MUCH' || stats.status === 'DEAD_ZONE') && (
                          <div className="text-xs text-red-400">
                            <span className="flex items-center gap-1">
                              {stats.status === 'DEAD_ZONE' && <span className="text-base">☠️</span>}
                              <ExclamationTriangleIcon className="w-3 h-3" /> 
                              {stats.status === 'DEAD_ZONE' ? 'Dead Zone - Critical improvement needed' :
                               stats.status === 'NEED_IMPROVEMENT_VERY_MUCH' ? 'Needs improvement very much' :
                               'Needs improvement'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
