#!/usr/bin/env python
"""
Script to fix daily plan question limit to 35
Run: cd backend && python manage.py shell -c "exec(open('../scripts/fix_plan_limit.py').read())"
"""

from api.models import DailyPlan, Attempt

def fix_plan_limit():
    date_key = '2026-01-13'
    MAX_PLANNED_QUESTIONS = 35
    
    print(f"\n{'='*60}")
    print(f"Fixing plan {date_key} to limit of {MAX_PLANNED_QUESTIONS} questions")
    print(f"{'='*60}\n")
    
    try:
        plan = DailyPlan.objects.get(date_key=date_key)
        print(f"[OK] Found plan: {date_key}")
        print(f"     Current questions: {len(plan.question_ids)}")
        print(f"     Answered: {plan.answered_count}")
        
        # Get answered question IDs (priority - keep these)
        attempts = Attempt.objects.filter(plan_date_key=date_key)
        answered_question_ids = list(set(a.question_id for a in attempts))
        
        print(f"[INFO] Found {len(answered_question_ids)} answered questions")
        
        # Start with answered questions
        final_question_ids = answered_question_ids.copy()
        
        # If we have less than MAX_PLANNED_QUESTIONS, add unasked questions from plan
        if len(final_question_ids) < MAX_PLANNED_QUESTIONS:
            current_question_ids = set(plan.question_ids)
            unasked_questions = list(current_question_ids - set(final_question_ids))
            remaining_slots = MAX_PLANNED_QUESTIONS - len(final_question_ids)
            final_question_ids.extend(unasked_questions[:remaining_slots])
        
        # Limit to MAX_PLANNED_QUESTIONS
        final_question_ids = final_question_ids[:MAX_PLANNED_QUESTIONS]
        
        # Save original count before updating
        original_count = len(plan.question_ids)
        
        # Update plan
        plan.question_ids = final_question_ids
        
        # Recompute stats
        final_question_ids_set = set(final_question_ids)
        relevant_attempts = [a for a in attempts if a.question_id in final_question_ids_set]
        
        plan.answered_count = len(relevant_attempts)
        plan.correct_count = sum(1 for a in relevant_attempts if a.is_correct)
        plan.wrong_count = plan.answered_count - plan.correct_count
        plan.accuracy = (
            (plan.correct_count / plan.answered_count * 100) 
            if plan.answered_count > 0 else 0
        )
        plan.is_complete = plan.answered_count >= len(plan.question_ids)
        
        plan.save()
        
        print(f"\n[OK] Updated plan:")
        print(f"     Questions: {len(plan.question_ids)} (was {original_count})")
        print(f"     Answered: {plan.answered_count}")
        print(f"     Correct: {plan.correct_count}")
        print(f"     Accuracy: {plan.accuracy:.2f}%")
        print(f"     Complete: {plan.is_complete}")
        
        print(f"\n{'='*60}")
        print(f"Fix completed successfully!")
        print(f"{'='*60}\n")
        
    except DailyPlan.DoesNotExist:
        print(f"[ERROR] Plan {date_key} does not exist")
    except Exception as e:
        print(f"\n[ERROR] An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

# Run the fix
fix_plan_limit()

