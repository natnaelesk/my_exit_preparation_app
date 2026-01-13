#!/usr/bin/env python
"""
Script to merge daily plan from 2026-01-14 to 2026-01-13
Run: cd backend && python manage.py shell < ../scripts/merge_plans.py
Or: cd backend && python -c "exec(open('../scripts/merge_plans.py').read())"
"""

from api.models import DailyPlan, Attempt
from django.db import transaction

def merge_plans():
    source_date = '2026-01-14'
    target_date = '2026-01-13'
    
    print(f"\n{'='*60}")
    print(f"Merging plan from {source_date} to {target_date}")
    print(f"{'='*60}\n")
    
    try:
        # Get source plan
        try:
            source_plan = DailyPlan.objects.get(date_key=source_date)
            print(f"[OK] Found source plan: {source_date}")
            print(f"     Subject: {source_plan.focus_subject}")
            print(f"     Questions: {len(source_plan.question_ids)}")
            print(f"     Answered: {source_plan.answered_count}")
            print(f"     Correct: {source_plan.correct_count}")
        except DailyPlan.DoesNotExist:
            print(f"[WARNING] Source plan {source_date} does not exist")
            source_plan = None
        
        # Get or create target plan
        try:
            target_plan = DailyPlan.objects.get(date_key=target_date)
            print(f"\n[OK] Found target plan: {target_date}")
            print(f"     Subject: {target_plan.focus_subject}")
            print(f"     Questions: {len(target_plan.question_ids)}")
            print(f"     Answered: {target_plan.answered_count}")
            print(f"     Correct: {target_plan.correct_count}")
        except DailyPlan.DoesNotExist:
            if source_plan:
                print(f"\n[INFO] Target plan {target_date} does not exist, creating from source...")
                target_plan = DailyPlan.objects.create(
                    date_key=target_date,
                    focus_subject=source_plan.focus_subject,
                    total_available_in_subject=source_plan.total_available_in_subject,
                    max_planned_questions=source_plan.max_planned_questions,
                    question_ids=source_plan.question_ids.copy(),
                    answered_count=0,
                    correct_count=0,
                    wrong_count=0,
                    accuracy=0.0,
                    is_complete=False,
                    motivational_quote=source_plan.motivational_quote
                )
                print(f"[OK] Created target plan: {target_date}")
            else:
                print(f"[ERROR] Cannot create target plan - source plan does not exist")
                return
        
        # Update attempts
        attempts_to_update = Attempt.objects.filter(plan_date_key=source_date)
        attempt_count = attempts_to_update.count()
        
        if attempt_count > 0:
            print(f"\n[INFO] Found {attempt_count} attempts to update")
            with transaction.atomic():
                updated = attempts_to_update.update(plan_date_key=target_date)
                print(f"[OK] Updated {updated} attempts from {source_date} to {target_date}")
        else:
            print(f"\n[INFO] No attempts found with plan_date_key={source_date}")
        
        # Merge plan data
        if source_plan:
            print(f"\n[INFO] Merging plan data...")
            
            MAX_PLANNED_QUESTIONS = 35
            
            # Get answered question IDs from source plan (the ones that were actually done)
            target_attempts = Attempt.objects.filter(plan_date_key=target_date)
            answered_question_ids = set(a.question_id for a in target_attempts)
            
            print(f"[INFO] Found {len(answered_question_ids)} answered questions from source plan")
            
            # Start with answered questions (priority)
            merged_question_ids = list(answered_question_ids)
            
            # If we have less than MAX_PLANNED_QUESTIONS, add unasked questions from source plan
            if len(merged_question_ids) < MAX_PLANNED_QUESTIONS:
                source_question_ids = set(source_plan.question_ids)
                unasked_from_source = source_question_ids - answered_question_ids
                remaining_slots = MAX_PLANNED_QUESTIONS - len(merged_question_ids)
                merged_question_ids.extend(list(unasked_from_source)[:remaining_slots])
            
            # If still less than MAX_PLANNED_QUESTIONS, add from target plan's unasked questions
            if len(merged_question_ids) < MAX_PLANNED_QUESTIONS:
                target_question_ids = set(target_plan.question_ids)
                unasked_from_target = target_question_ids - set(merged_question_ids)
                remaining_slots = MAX_PLANNED_QUESTIONS - len(merged_question_ids)
                merged_question_ids.extend(list(unasked_from_target)[:remaining_slots])
            
            # Limit to MAX_PLANNED_QUESTIONS
            merged_question_ids = merged_question_ids[:MAX_PLANNED_QUESTIONS]
            
            target_plan.question_ids = merged_question_ids
            
            # Recompute stats (only count attempts for questions in the plan)
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
            
            if not target_plan.focus_subject and source_plan.focus_subject:
                target_plan.focus_subject = source_plan.focus_subject
            
            target_plan.save()
            
            print(f"[OK] Updated target plan:")
            print(f"     Questions: {len(target_plan.question_ids)} (limit: {MAX_PLANNED_QUESTIONS})")
            print(f"     Answered: {target_plan.answered_count}")
            print(f"     Correct: {target_plan.correct_count}")
            print(f"     Accuracy: {target_plan.accuracy:.2f}%")
            print(f"     Complete: {target_plan.is_complete}")
        
        # Delete source plan
        if source_plan:
            print(f"\n[INFO] Deleting source plan {source_date}...")
            source_plan.delete()
            print(f"[OK] Deleted source plan {source_date}")
        
        print(f"\n{'='*60}")
        print(f"Merge completed successfully!")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n[ERROR] An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

# Run the merge
merge_plans()

