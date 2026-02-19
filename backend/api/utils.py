"""
Utility functions for the API
"""
from datetime import datetime, timedelta, timezone

# Ethiopian timezone settings
ETHIOPIA_TIMEZONE_OFFSET = timedelta(hours=3)  # UTC+3
DAY_BOUNDARY_HOUR = 6  # Day changes at 6 AM Ethiopian time


def get_ethiopian_date_key(dt=None):
    """
    Get date key in format YYYY-MM-DD for Ethiopian timezone
    Day boundary is at 6 AM Ethiopian time instead of midnight
    
    Args:
        dt: datetime object (defaults to now in UTC)
    
    Returns:
        str: Date key in format YYYY-MM-DD
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    
    # Ensure datetime is timezone-aware (convert to UTC if naive)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        # Convert to UTC if not already
        dt = dt.astimezone(timezone.utc)
    
    # Convert to Ethiopian time (UTC+3)
    ethiopian_time = dt + ETHIOPIA_TIMEZONE_OFFSET
    
    # Get Ethiopian date components
    ethiopian_year = ethiopian_time.year
    ethiopian_month = ethiopian_time.month
    ethiopian_day = ethiopian_time.day
    ethiopian_hour = ethiopian_time.hour
    
    # If before 6 AM Ethiopian time, use previous day
    if ethiopian_hour < DAY_BOUNDARY_HOUR:
        # Subtract one day
        previous_day = ethiopian_time - timedelta(days=1)
        ethiopian_year = previous_day.year
        ethiopian_month = previous_day.month
        ethiopian_day = previous_day.day
    
    return f"{ethiopian_year}-{ethiopian_month:02d}-{ethiopian_day:02d}"







