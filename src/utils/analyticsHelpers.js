/**
 * Format duration in seconds to human-readable string
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

/**
 * Get status color for subject/topic
 */
export const getStatusColor = (status) => {
  const colors = {
    STRONG: '#10b981', // green
    MEDIUM: '#f59e0b', // amber
    WEAK: '#ef4444'    // red
  };
  return colors[status] || '#6b7280'; // gray default
};

/**
 * Get status badge class
 */
export const getStatusBadgeClass = (status) => {
  return `status-badge status-${status.toLowerCase()}`;
};

