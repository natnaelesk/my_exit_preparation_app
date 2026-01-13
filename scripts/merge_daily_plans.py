"""
Script to merge daily plan data from one date to another
Usage: python manage.py shell < scripts/merge_daily_plans.py
Or: cd backend && python manage.py shell
Then copy-paste the code below
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from api.models import DailyPlan, Attempt
from django.db import transaction

def merge_daily_plans(source_date_key, target_date_key):
    """
    Merge daily plan data from source_date_key to target_date_key
    
    Args:
        source_date_key: Date key to merge from (e.g., "2026-01-14")
        target_date_key: Date key to merge to (e.g., "2026-01-13")
    """
    print(f"\n{'='*60}")
    print(f"Merging plan from {source_date_key} to {target_date_key}")
    print(f"{'='*60}\n")
    
    try:
        # Get source plan
        try:
            source_plan = DailyPlan.objects.get(date_key=source_date_key)
            print(f"[OK] Found source plan: {source_date_key}")
            print(f"     Subject: {source_plan.focus_subject}")
            print(f"     Questions: {len(source_plan.question_ids)}")
            print(f"     Answered: {source_plan.answered_count}")
            print(f"     Correct: {source_plan.correct_count}")
        except DailyPlan.DoesNotExist:
            print(f"[WARNING] Source plan {source_date_key} does not exist")
            source_plan = None
        
        # Get or create target plan
        try:
            target_plan = DailyPlan.objects.get(date_key=target_date_key)
            print(f"\n[OK] Found target plan: {target_date_key}")
            print(f"     Subject: {target_plan.focus_subject}")
            print(f"     Questions: {len(target_plan.question_ids)}")
            print(f"     Answered: {target_plan.answered_count}")
            print(f"     Correct: {target_plan.correct_count}")
        except DailyPlan.DoesNotExist:
            if source_plan:
                # Create target plan from source plan
                print(f"\n[INFO] Target plan {target_date_key} does not exist, creating from source...")
                target_plan = DailyPlan.objects.create(
                    date_key=target_date_key,
                    focus_subject=source_plan.focus_subject,
                    total_available_in_subject=source_plan.total_available_in_subject,
                    max_planned_questions=source_plan.max_planned_questions,
                    question_ids=source_plan.question_ids.copy(),
                    answered_count=0,  # Will be recalculated
                    correct_count=0,
                    wrong_count=0,
                    accuracy=0.0,
                    is_complete=False,
                    motivational_quote=source_plan.motivational_quote
                )
                print(f"[OK] Created target plan: {target_date_key}")
            else:
                print(f"[ERROR] Cannot create target plan - source plan does not exist")
                return
        
        # Update attempts: change plan_date_key from source to target
        attempts_to_update = Attempt.objects.filter(plan_date_key=source_date_key)
        attempt_count = attempts_to_update.count()
        
        if attempt_count > 0:
            print(f"\n[INFO] Found {attempt_count} attempts to update")
            with transaction.atomic():
                updated = attempts_to_update.update(plan_date_key=target_date_key)
                print(f"[OK] Updated {updated} attempts from {source_date_key} to {target_date_key}")
        else:
            print(f"\n[INFO] No attempts found with plan_date_key={source_date_key}")
        
        # Merge plan data if source plan exists
        if source_plan:
            print(f"\n[INFO] Merging plan data...")
            
            # Combine question IDs (unique)
            target_question_ids = set(target_plan.question_ids)
            source_question_ids = set(source_plan.question_ids)
            merged_question_ids = list(target_question_ids.union(source_question_ids))
            
            # Update target plan
            target_plan.question_ids = merged_question_ids
            
            # Recompute stats for target plan
            target_attempts = Attempt.objects.filter(plan_date_key=target_date_key)
            target_question_ids_set = set(target_plan.question_ids)
            
            relevant_attempts = [
                a for a in target_attempts 
                if a.question_id in target_question_ids_set
            ]
            
            target_plan.answered_count = len(relevant_attempts)
            target_plan.correct_count = sum(1 for a in relevant_attempts if a.is_correct)
            target_plan.wrong_count = target_plan.answered_count - target_plan.correct_count
            target_plan.accuracy = (
                (target_plan.correct_count / target_plan.answered_count * 100) 
                if target_plan.answered_count > 0 else 0
            )
            target_plan.is_complete = target_plan.answered_count >= len(target_plan.question_ids)
            
            # Use source plan's subject if target doesn't have one, or keep target's
            if not target_plan.focus_subject and source_plan.focus_subject:
                target_plan.focus_subject = source_plan.focus_subject
            
            target_plan.save()
            
            print(f"[OK] Updated target plan:")
            print(f"     Questions: {len(target_plan.question_ids)}")
            print(f"     Answered: {target_plan.answered_count}")
            print(f"     Correct: {target_plan.correct_count}")
            print(f"     Accuracy: {target_plan.accuracy:.2f}%")
            print(f"     Complete: {target_plan.is_complete}")
        
        # Delete source plan
        if source_plan:
            print(f"\n[INFO] Deleting source plan {source_date_key}...")
            source_plan.delete()
            print(f"[OK] Deleted source plan {source_date_key}")
        
        print(f"\n{'='*60}")
        print(f"Merge completed successfully!")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n[ERROR] An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == '__main__':
    # Merge from 2026-01-14 to 2026-01-13
    merge_daily_plans('2026-01-14', '2026-01-13')

