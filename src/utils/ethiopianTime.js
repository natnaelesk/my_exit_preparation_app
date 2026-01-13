/**
 * Ethiopian Timezone Utilities
 * Ethiopia uses EAT (East Africa Time, UTC+3)
 * Day boundary is at 6 AM local time instead of midnight
 */

const ETHIOPIA_TIMEZONE_OFFSET = 3; // UTC+3
const DAY_BOUNDARY_HOUR = 6; // Day changes at 6 AM

/**
 * Get current date in Ethiopian timezone
 * Adjusts for 6 AM day boundary
 */
export function getEthiopianDate(date = new Date()) {
  // Get UTC components
  const utcTime = date.getTime();
  const utcDate = new Date(utcTime);
  
  // Convert to Ethiopian time (UTC+3) by adding 3 hours
  const ethiopianTimeMs = utcTime + (ETHIOPIA_TIMEZONE_OFFSET * 60 * 60 * 1000);
  const ethiopianDate = new Date(ethiopianTimeMs);
  
  // Get Ethiopian date components (using UTC methods since we manually added offset)
  const ethiopianYear = ethiopianDate.getUTCFullYear();
  const ethiopianMonth = ethiopianDate.getUTCMonth();
  const ethiopianDay = ethiopianDate.getUTCDate();
  const ethiopianHours = ethiopianDate.getUTCHours();
  
  // If before 6 AM Ethiopian time, use previous day
  if (ethiopianHours < DAY_BOUNDARY_HOUR) {
    // Subtract one day
    const previousDayMs = ethiopianTimeMs - (24 * 60 * 60 * 1000);
    const previousDay = new Date(previousDayMs);
    return {
      year: previousDay.getUTCFullYear(),
      month: previousDay.getUTCMonth(),
      day: previousDay.getUTCDate()
    };
  }
  
  return {
    year: ethiopianYear,
    month: ethiopianMonth,
    day: ethiopianDay
  };
}

/**
 * Get date key in format YYYY-MM-DD for Ethiopian timezone
 * Day boundary is at 6 AM Ethiopian time
 */
export function getEthiopianDateKey(date = new Date()) {
  const { year, month, day } = getEthiopianDate(date);
  const monthStr = String(month + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

/**
 * Convert a timestamp to Ethiopian date key
 * Useful for backend timestamps
 */
export function timestampToEthiopianDateKey(timestamp) {
  // Handle both Date objects and ISO strings
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return getEthiopianDateKey(date);
}

/**
 * Check if a date is today in Ethiopian timezone
 */
export function isTodayEthiopian(date) {
  const todayKey = getEthiopianDateKey();
  const dateKey = getEthiopianDateKey(date);
  return todayKey === dateKey;
}

/**
 * Get Ethiopian timezone offset in hours
 */
export function getEthiopianTimezoneOffset() {
  return ETHIOPIA_TIMEZONE_OFFSET;
}

/**
 * Get day boundary hour
 */
export function getDayBoundaryHour() {
  return DAY_BOUNDARY_HOUR;
}

/**
 * Check if the day has ended in Ethiopian timezone
 * Day ends at 6 AM next day (so if it's past 6 AM, the previous day has ended)
 */
export function hasDayEnded(date = new Date()) {
  const utcTime = date.getTime();
  const ethiopianTimeMs = utcTime + (ETHIOPIA_TIMEZONE_OFFSET * 60 * 60 * 1000);
  const ethiopianDate = new Date(ethiopianTimeMs);
  const ethiopianHours = ethiopianDate.getUTCHours();
  
  // If it's 6 AM or later, the previous day has ended
  return ethiopianHours >= DAY_BOUNDARY_HOUR;
}

