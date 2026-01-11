import { STATUS_THRESHOLDS } from './constants';

/**
 * Calculate status from accuracy percentage
 */
export const calculateStatus = (accuracy) => {
  if (accuracy >= STATUS_THRESHOLDS.EXCELLENT) {
    return 'EXCELLENT';
  } else if (accuracy >= STATUS_THRESHOLDS.VERY_GOOD) {
    return 'VERY_GOOD';
  } else if (accuracy >= STATUS_THRESHOLDS.GOOD) {
    return 'GOOD';
  } else if (accuracy >= STATUS_THRESHOLDS.MODERATE) {
    return 'MODERATE';
  } else if (accuracy >= STATUS_THRESHOLDS.NEED_IMPROVEMENT) {
    return 'NEED_IMPROVEMENT';
  } else if (accuracy >= STATUS_THRESHOLDS.NEED_IMPROVEMENT_VERY_MUCH) {
    return 'NEED_IMPROVEMENT_VERY_MUCH';
  } else {
    return 'DEAD_ZONE';
  }
};

/**
 * Get status color and styling
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'EXCELLENT':
      return { 
        primary: '#fbbf24', // gold
        bg: 'rgba(251, 191, 36, 0.15)', 
        border: 'rgba(251, 191, 36, 0.4)',
        text: 'text-yellow-500',
        bgClass: 'bg-yellow-500/15',
        borderClass: 'border-yellow-500/40'
      };
    case 'VERY_GOOD':
      return { 
        primary: '#10b981', // green
        bg: 'rgba(16, 185, 129, 0.1)', 
        border: 'rgba(16, 185, 129, 0.3)',
        text: 'text-green-500',
        bgClass: 'bg-green-500/10',
        borderClass: 'border-green-500/30'
      };
    case 'GOOD':
      return { 
        primary: '#22c55e', // light green
        bg: 'rgba(34, 197, 94, 0.1)', 
        border: 'rgba(34, 197, 94, 0.3)',
        text: 'text-green-400',
        bgClass: 'bg-green-400/10',
        borderClass: 'border-green-400/30'
      };
    case 'MODERATE':
      return { 
        primary: '#f59e0b', // amber
        bg: 'rgba(245, 158, 11, 0.1)', 
        border: 'rgba(245, 158, 11, 0.3)',
        text: 'text-yellow-500',
        bgClass: 'bg-yellow-500/10',
        borderClass: 'border-yellow-500/30'
      };
    case 'NEED_IMPROVEMENT':
      return { 
        primary: '#f97316', // orange
        bg: 'rgba(249, 115, 22, 0.1)', 
        border: 'rgba(249, 115, 22, 0.3)',
        text: 'text-orange-500',
        bgClass: 'bg-orange-500/10',
        borderClass: 'border-orange-500/30'
      };
    case 'NEED_IMPROVEMENT_VERY_MUCH':
      return { 
        primary: '#ef4444', // red
        bg: 'rgba(239, 68, 68, 0.1)', 
        border: 'rgba(239, 68, 68, 0.3)',
        text: 'text-red-500',
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500/30'
      };
    case 'DEAD_ZONE':
      return { 
        primary: '#dc2626', // dark red
        bg: 'rgba(220, 38, 38, 0.15)', 
        border: 'rgba(220, 38, 38, 0.4)',
        text: 'text-red-600',
        bgClass: 'bg-red-600/15',
        borderClass: 'border-red-600/40'
      };
    default:
      return { 
        primary: '#6b7280', 
        bg: 'rgba(107, 114, 128, 0.1)', 
        border: 'rgba(107, 114, 128, 0.3)',
        text: 'text-muted',
        bgClass: 'bg-surface',
        borderClass: 'border-border'
      };
  }
};

/**
 * Get status label for display
 */
export const getStatusLabel = (status) => {
  switch (status) {
    case 'EXCELLENT': return 'Excellent';
    case 'VERY_GOOD': return 'Very Good';
    case 'GOOD': return 'Good';
    case 'MODERATE': return 'Moderate';
    case 'NEED_IMPROVEMENT': return 'Need Improvement';
    case 'NEED_IMPROVEMENT_VERY_MUCH': return 'Need Improvement Very Much';
    case 'DEAD_ZONE': return 'Dead Zone';
    default: return 'N/A';
  }
};

