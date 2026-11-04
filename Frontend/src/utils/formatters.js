import {
  format,
  isToday,
  isYesterday,
  isThisWeek,
  isThisYear,
  formatDistanceToNowStrict,
} from 'date-fns';

/**
 * Format message time to HH:mm (e.g., "14:30")
 * @param {string|number|Date} dateValue
 * @returns {string}
 */
export const formatTime = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return format(date, 'HH:mm');
  } catch (error) {
    return '';
  }
};

/**
 * Format date for chat message separators (e.g., "Today", "Yesterday", "Monday, Nov 4, 2026")
 * @param {string|number|Date} dateValue
 * @returns {string}
 */
export const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isThisYear(date)) return format(date, 'EEEE, MMM d');
    return format(date, 'EEEE, MMM d, yyyy');
  } catch (error) {
    return '';
  }
};

/**
 * Format relative time for conversation list (e.g. "just now", "2m ago", "1h ago", "yesterday", "Mon")
 * @param {string|number|Date} dateValue
 * @returns {string}
 */
export const formatRelativeTime = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) {
      return 'just now';
    }
    if (diffSec < 3600) {
      const minutes = Math.floor(diffSec / 60);
      return `${minutes}m ago`;
    }
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    if (isThisWeek(date)) {
      return format(date, 'EEE');
    }
    if (isThisYear(date)) {
      return format(date, 'MMM d');
    }
    return format(date, 'dd/MM/yy');
  } catch (error) {
    return '';
  }
};

/**
 * Format byte count to human-readable string (e.g., "1.4 MB", "350 KB")
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
export const formatFileSize = (bytes, decimals = 1) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Truncate text with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export const truncateText = (text, maxLength = 35) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

/**
 * Get initials for fallback avatar (e.g., "John Doe" -> "JD", "Alex" -> "A")
 * @param {string} name
 * @returns {string}
 */
export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
