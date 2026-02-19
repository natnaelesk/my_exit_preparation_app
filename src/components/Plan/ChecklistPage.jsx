import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getSubjectPriorities, 
  reorderSubjects, 
  toggleSubjectCompletion, 
  startRoundTwo 
} from '../../services/subjectPriorityService';
import { calculateSubjectStats } from '../../services/analyticsService';
import { OFFICIAL_SUBJECTS } from '../../utils/constants';
import LoadingAnimation from '../Common/LoadingAnimation';
import ButtonLoading from '../Common/ButtonLoading';
import {
  CheckCircleIcon,
  Bars3Icon,
  ArrowPathIcon,
  XMarkIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const ChecklistPage = () => {
  const navigate = useNavigate();
  const [priorities, setPriorities] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('Loading subject priorities...');
      const [prioritiesData, stats] = await Promise.all([
        getSubjectPriorities(),
        calculateSubjectStats()
      ]);
      
      console.log('Priorities data received:', prioritiesData);
      console.log('Stats data received:', stats);
      
      // Sort by priority_order
      const sorted = prioritiesData && prioritiesData.length > 0
        ? [...prioritiesData].sort((a, b) => a.priorityOrder - b.priorityOrder)
        : [];
      
      console.log('Sorted priorities:', sorted);
      setPriorities(sorted);
      setSubjectStats(stats);
    } catch (error) {
      console.error('Error loading checklist data:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        stack: error.stack
      });
      // On error, set empty array so we don't show "loading" forever
      setPriorities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPriorities = [...priorities];
    const draggedItem = newPriorities[draggedIndex];
    
    // Remove dragged item
    newPriorities.splice(draggedIndex, 1);
    
    // Insert at new position
    newPriorities.splice(dropIndex, 0, draggedItem);
    
    // Update priority order
    const updatedPriorities = newPriorities.map((p, idx) => ({
      ...p,
      priorityOrder: idx
    }));
    
    setPriorities(updatedPriorities);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Save to backend
    try {
      setIsSaving(true);
      const subjectOrder = updatedPriorities.map(p => p.subject);
      await reorderSubjects(subjectOrder);
    } catch (error) {
      console.error('Error saving order:', error);
      // Revert on error
      loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCompletion = async (subject) => {
    try {
      setIsSaving(true);
      const updated = await toggleSubjectCompletion(subject);
      
      // Update local state
      setPriorities(prev => 
        prev.map(p => p.subject === subject ? updated : p)
      );
    } catch (error) {
      console.error('Error toggling completion:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoundTwo = async () => {
    if (!window.confirm('Start Round Two? This will uncheck all subjects and increment the round number.')) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await startRoundTwo();
      const sorted = [...updated].sort((a, b) => a.priorityOrder - b.priorityOrder);
      setPriorities(sorted);
    } catch (error) {
      console.error('Error starting round two:', error);
      alert('Error starting round two: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getSubjectStat = (subject) => {
    return subjectStats[subject] || {
      accuracy: 0,
      totalAttempted: 0,
      status: 'N/A'
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'EXCELLENT':
      case 'VERY_GOOD':
        return 'text-green-500 bg-green-500/10';
      case 'GOOD':
      case 'MODERATE':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'NEED_IMPROVEMENT':
      case 'NEED_IMPROVEMENT_VERY_MUCH':
      case 'DEAD_ZONE':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-text-secondary bg-surface';
    }
  };

  const allCompleted = priorities.length > 0 && priorities.every(p => p.isCompleted);
  const completedCount = priorities.filter(p => p.isCompleted).length;
  const activeCount = priorities.length - completedCount;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border-b-2 border-primary-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/plan')}
                className="p-2 rounded-lg hover:bg-surface/50 transition-colors border border-border/50 hover:border-primary-500/50"
                aria-label="Back to plan"
              >
                <ArrowLeftIcon className="w-6 h-6 text-text" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-primary-600 bg-clip-text text-transparent">
                  Plan Manager
                </h1>
                <p className="text-muted text-sm mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-red-500">🎯 Top = Weakest</span>
                  <span>•</span>
                  <span>Drag to reorder</span>
                  <span>•</span>
                  <span>Check to complete</span>
                </p>
              </div>
            </div>
            {allCompleted && (
              <button
                onClick={handleRoundTwo}
                disabled={isSaving}
                className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <ButtonLoading text="Starting..." />
                ) : (
                  <>
                    <ArrowPathIcon className="w-5 h-5" />
                    <span>Round Two</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-card to-primary-500/5 border-2 border-primary-500/20 rounded-xl p-5 shadow-md">
            <div className="text-xs text-muted uppercase tracking-wide mb-2">Total Subjects</div>
            <div className="text-3xl font-bold text-text">{priorities.length}</div>
            <div className="text-xs text-muted mt-1">All subjects</div>
          </div>
          <div className="bg-gradient-to-br from-card to-primary-500/5 border-2 border-primary-500/20 rounded-xl p-5 shadow-md">
            <div className="text-xs text-muted uppercase tracking-wide mb-2">Active</div>
            <div className="text-3xl font-bold text-primary-500">{activeCount}</div>
            <div className="text-xs text-muted mt-1">Need practice</div>
          </div>
          <div className="bg-gradient-to-br from-card to-green-500/5 border-2 border-green-500/20 rounded-xl p-5 shadow-md">
            <div className="text-xs text-muted uppercase tracking-wide mb-2">Completed</div>
            <div className="text-3xl font-bold text-green-500">{completedCount}</div>
            <div className="text-xs text-muted mt-1">Finished</div>
          </div>
        </div>

        {/* Bento Box Layout: Priority List (Left) + Checklist (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Priority List (Draggable) */}
          <div className="bg-gradient-to-br from-card via-card to-primary-500/5 border-2 border-primary-500/20 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <Bars3Icon className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text">Priority Order</h2>
                <p className="text-xs text-muted">Weakest → Strongest (Top to Bottom)</p>
              </div>
            </div>
            <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-text">
                <span className="font-semibold">💡 Tip:</span> Drag subjects to reorder. 
                <span className="text-primary-500 font-medium"> Top = Weakest</span> (gets more focus in daily plans).
              </p>
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="text-center py-8">
                  <LoadingAnimation message="Loading subjects..." size="small" />
                </div>
              ) : priorities.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <p>No subjects found. Please check your connection.</p>
                </div>
              ) : (
                priorities.map((priority, index) => {
                  const stat = getSubjectStat(priority.subject);
                  const isDragging = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;

                  return (
                    <div
                      key={priority.subject}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`
                        group relative bg-gradient-to-r from-surface/80 to-surface/40 border-2 rounded-xl p-4 transition-all cursor-move
                        ${isDragging ? 'opacity-50 scale-95 z-50 shadow-2xl' : ''}
                        ${isDragOver ? 'border-primary-500 bg-primary-500/20 scale-105 shadow-lg' : 'border-border/50 hover:border-primary-500/70 hover:shadow-md'}
                        ${priority.isCompleted ? 'opacity-50' : 'hover:bg-surface'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {/* Drag Handle */}
                        <div className="flex-shrink-0 text-muted group-hover:text-primary-500 transition-colors">
                          <Bars3Icon className="w-5 h-5" />
                        </div>

                        {/* Priority Number - Visual indicator */}
                        <div className={`
                          flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm
                          ${index === 0 ? 'bg-red-500/20 text-red-500 border-2 border-red-500/30' : ''}
                          ${index > 0 && index < 3 ? 'bg-orange-500/20 text-orange-500 border-2 border-orange-500/30' : ''}
                          ${index >= 3 && index < 7 ? 'bg-yellow-500/20 text-yellow-500 border-2 border-yellow-500/30' : ''}
                          ${index >= 7 ? 'bg-primary-500/10 text-primary-500 border-2 border-primary-500/20' : ''}
                        `}>
                          <span>#{index + 1}</span>
                        </div>

                        {/* Subject Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold text-base ${priority.isCompleted ? 'line-through text-muted' : 'text-text'}`}>
                              {priority.subject}
                            </h3>
                            {index === 0 && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs font-bold rounded-full border border-red-500/30">
                                WEAKEST
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(stat.status)}`}>
                              {stat.status}
                            </div>
                            {stat.totalAttempted > 0 ? (
                              <>
                                <span className="text-xs text-muted font-medium">
                                  {Math.round(stat.accuracy)}% accuracy
                                </span>
                                <span className="text-xs text-muted">
                                  • {stat.totalAttempted} attempts
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted italic">No attempts yet</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Checklist */}
          <div className="bg-gradient-to-br from-card via-card to-green-500/5 border-2 border-green-500/20 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text">Checklist</h2>
                <p className="text-xs text-muted">Mark completed subjects</p>
              </div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-text">
                <span className="font-semibold">✓ Check</span> subjects you've finished. 
                Completed subjects are <span className="text-green-500 font-medium">excluded</span> from daily plans.
              </p>
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="text-center py-8">
                  <LoadingAnimation message="Loading checklist..." size="small" />
                </div>
              ) : priorities.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <p>No subjects found. Please check your connection.</p>
                </div>
              ) : (
                priorities.map((priority, index) => {
                  const stat = getSubjectStat(priority.subject);

                  return (
                    <div
                      key={priority.subject}
                      className={`
                        group relative bg-gradient-to-r rounded-xl p-4 transition-all border-2
                        ${priority.isCompleted 
                          ? 'bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/40 shadow-md' 
                          : 'bg-gradient-to-r from-surface/80 to-surface/40 border-border/50 hover:border-green-500/50 hover:shadow-md'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox - Larger and more prominent */}
                        <div className="flex-shrink-0">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={priority.isCompleted}
                              onChange={() => handleToggleCompletion(priority.subject)}
                              disabled={isSaving}
                              className="sr-only peer"
                            />
                            <div className={`
                              w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                              ${priority.isCompleted 
                                ? 'bg-green-500 border-green-500 shadow-lg' 
                                : 'bg-surface border-border group-hover:border-green-500/50'
                              }
                              peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
                            `}>
                              {priority.isCompleted && (
                                <CheckCircleIcon className="w-4 h-4 text-white" />
                              )}
                            </div>
                          </label>
                        </div>

                        {/* Subject Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className={`
                              font-semibold text-base
                              ${priority.isCompleted 
                                ? 'line-through text-muted' 
                                : 'text-text'
                              }
                            `}>
                              {priority.subject}
                            </h3>
                            {priority.isCompleted && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs font-bold rounded-full border border-green-500/30 flex items-center gap-1">
                                <CheckCircleIcon className="w-3 h-3" />
                                DONE
                              </span>
                            )}
                            {priority.roundNumber > 1 && (
                              <span className="px-2 py-0.5 bg-primary-500/20 text-primary-500 text-xs font-semibold rounded-full border border-primary-500/30">
                                Round {priority.roundNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(stat.status)}`}>
                              {stat.status}
                            </div>
                            {stat.totalAttempted > 0 ? (
                              <>
                                <span className="text-xs text-muted font-medium">
                                  {Math.round(stat.accuracy)}%
                                </span>
                                <span className="text-xs text-muted">
                                  • {stat.totalAttempted} attempts
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted italic">No attempts yet</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-surface/50 border border-border rounded-xl p-4">
          <div className="text-sm text-muted">
            <p className="mb-2">
              <strong className="text-text">How it works:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Subjects are ordered from weakest (top) to strongest (bottom) by default</li>
              <li>Drag subjects in the Priority Order column to reorder them</li>
              <li>Check subjects in the Checklist column to mark them as completed</li>
              <li>Completed subjects are excluded from daily plan generation</li>
              <li>When all subjects are checked, click "Round Two" to start a new round</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;

