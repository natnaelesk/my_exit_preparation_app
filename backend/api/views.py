from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import datetime, timedelta
import json
from .models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences, SubjectPriority
from .serializers import (
    QuestionSerializer, ExamSerializer, AttemptSerializer, 
    ExamSessionSerializer, DailyPlanSerializer, ThemePreferencesSerializer, SubjectPrioritySerializer
)
from .utils import get_ethiopian_date_key

# Official subjects list (from constants)
OFFICIAL_SUBJECTS = [
    'Computer Programming',
    'Object Oriented Programming',
    'Data Structures and Algorithms',
    'Design and Analysis of Algorithms',
    'Database Systems',
    'Software Engineering',
    'Web Programming',
    'Operating System',
    'Computer Organization and Architecture',
    'Data Communication and Computer Networking',
    'Computer Security',
    'Network and System Administration',
    'Introduction to Artificial Intelligence',
    'Automata and Complexity Theory',
    'Compiler Design'
]


def calculate_status(accuracy):
    """Calculate status based on accuracy"""
    if accuracy >= 90:
        return 'EXCELLENT'
    elif accuracy >= 80:
        return 'VERY_GOOD'
    elif accuracy >= 70:
        return 'GOOD'
    elif accuracy >= 60:
        return 'MODERATE'
    elif accuracy >= 50:
        return 'NEED_IMPROVEMENT'
    elif accuracy >= 30:
        return 'NEED_IMPROVEMENT_VERY_MUCH'
    else:
        return 'DEAD_ZONE'


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    
    def get_queryset(self):
        queryset = Question.objects.all()
        subject = self.request.query_params.get('subject', None)
        topic = self.request.query_params.get('topic', None)
        
        if subject:
            queryset = queryset.filter(subject=subject)
        if topic:
            queryset = queryset.filter(topic=topic)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def bulk(self, request):
        """Get multiple questions by IDs or create multiple questions"""
        if 'questionIds' in request.data:
            # Get multiple questions by IDs
            question_ids = request.data.get('questionIds', [])
            questions = Question.objects.filter(question_id__in=question_ids)
            serializer = self.get_serializer(questions, many=True)
            return Response(serializer.data)
        elif 'questions' in request.data:
            # Bulk create questions
            questions_data = request.data.get('questions', [])
            created_questions = []
            errors = []
            
            for i, q_data in enumerate(questions_data):
                try:
                    # Generate question_id if not provided
                    if 'questionId' not in q_data:
                        import uuid
                        q_data['questionId'] = f"q_{uuid.uuid4().hex[:16]}"
                    
                    serializer = self.get_serializer(data=q_data)
                    if serializer.is_valid():
                        question = serializer.save()
                        created_questions.append(question)
                    else:
                        errors.append({
                            'index': i + 1,
                            'error': serializer.errors,
                            'question': q_data.get('question', 'Unknown')[:100]
                        })
                except Exception as e:
                    errors.append({
                        'index': i + 1,
                        'error': str(e),
                        'question': q_data.get('question', 'Unknown')[:100]
                    })
            
            result_serializer = self.get_serializer(created_questions, many=True)
            return Response({
                'questions': result_serializer.data,
                'created': len(created_questions),
                'errors': errors if errors else None
            })
        else:
            return Response({'error': 'questionIds or questions required'}, status=status.HTTP_400_BAD_REQUEST)


class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    
    def perform_create(self, serializer):
        import uuid
        exam_id = f"exam_{uuid.uuid4().hex[:16]}"
        serializer.save(exam_id=exam_id)


class AttemptViewSet(viewsets.ModelViewSet):
    queryset = Attempt.objects.all()
    serializer_class = AttemptSerializer
    
    def get_queryset(self):
        queryset = Attempt.objects.all()
        subject = self.request.query_params.get('subject', None)
        topic = self.request.query_params.get('topic', None)
        question_id = self.request.query_params.get('questionId', None)
        
        if subject:
            queryset = queryset.filter(subject=subject)
        if topic:
            queryset = queryset.filter(topic=topic)
        if question_id:
            queryset = queryset.filter(question_id=question_id)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def answered_ids(self, request):
        """Get all answered question IDs"""
        answered_ids = Attempt.objects.values_list('question_id', flat=True).distinct()
        return Response(list(answered_ids))


class ExamSessionViewSet(viewsets.ModelViewSet):
    queryset = ExamSession.objects.all()
    serializer_class = ExamSessionSerializer
    
    @action(detail=False, methods=['get'])
    def incomplete(self, request):
        """Get all incomplete sessions"""
        incomplete = ExamSession.objects.filter(is_complete=False)
        serializer = self.get_serializer(incomplete, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def progress(self, request, pk=None):
        """Save exam progress"""
        session = self.get_object()
        data = request.data
        
        if 'currentIndex' in data:
            session.current_index = data['currentIndex']
        if 'answers' in data:
            session.answers = data['answers']
        if 'timeSpent' in data:
            session.time_spent = data['timeSpent']
        if 'isComplete' in data:
            session.is_complete = data['isComplete']
        if 'isPaused' in data:
            session.is_paused = data['isPaused']
        
        session.save()
        serializer = self.get_serializer(session)
        return Response(serializer.data)


class DailyPlanViewSet(viewsets.ModelViewSet):
    queryset = DailyPlan.objects.all()
    serializer_class = DailyPlanSerializer
    lookup_field = 'date_key'
    lookup_value_regex = '[^/]+'  # Allow date format in URL
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent daily plans"""
        days = int(request.query_params.get('days', 7))
        recent = DailyPlan.objects.all().order_by('-date_key')[:days]
        serializer = self.get_serializer(recent, many=True)
        return Response(serializer.data)
    
    def create(self, request):
        """Create a new daily plan (get_or_create logic)"""
        date_key = request.data.get('dateKey')
        if not date_key:
            return Response({'error': 'dateKey is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if plan already exists
        try:
            plan = DailyPlan.objects.get(date_key=date_key)
            serializer = self.get_serializer(plan)
            return Response(serializer.data)
        except DailyPlan.DoesNotExist:
            # Create new plan
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def retrieve(self, request, date_key=None):
        """Get daily plan by date_key"""
        try:
            plan = DailyPlan.objects.get(date_key=date_key)
            serializer = self.get_serializer(plan)
            return Response(serializer.data)
        except DailyPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def recompute(self, request, date_key=None):
        """Recompute daily plan stats"""
        try:
            plan = DailyPlan.objects.get(date_key=date_key)
            # Get attempts for this plan
            plan_attempts = Attempt.objects.filter(plan_date_key=date_key)
            plan_question_ids = set(plan.question_ids)
            
            relevant_attempts = [a for a in plan_attempts if a.question_id in plan_question_ids]
            
            plan.answered_count = len(relevant_attempts)
            plan.correct_count = sum(1 for a in relevant_attempts if a.is_correct)
            plan.wrong_count = plan.answered_count - plan.correct_count
            plan.accuracy = (plan.correct_count / plan.answered_count * 100) if plan.answered_count > 0 else 0
            plan.is_complete = plan.answered_count >= len(plan.question_ids)
            plan.save()
            
            serializer = self.get_serializer(plan)
            return Response(serializer.data)
        except DailyPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['patch'])
    def complete(self, request, date_key=None):
        """Mark daily plan as complete"""
        try:
            plan = DailyPlan.objects.get(date_key=date_key)
            plan.is_complete = True
            plan.save()
            serializer = self.get_serializer(plan)
            return Response(serializer.data)
        except DailyPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)


class ThemePreferencesViewSet(viewsets.ModelViewSet):
    queryset = ThemePreferences.objects.all()
    serializer_class = ThemePreferencesSerializer
    
    def get_object(self):
        obj, created = ThemePreferences.objects.get_or_create(id='themePreferences')
        return obj


class SubjectPriorityViewSet(viewsets.ModelViewSet):
    queryset = SubjectPriority.objects.all()
    serializer_class = SubjectPrioritySerializer
    lookup_field = 'subject'
    
    def list(self, request):
        """Get all subject priorities, initialize if needed"""
        priorities = list(SubjectPriority.objects.all())
        
        # If no priorities exist, initialize them based on weakness scores
        if not priorities:
            # Calculate weakness scores for all subjects
            all_attempts = Attempt.objects.all()
            attempts_by_subject = {}
            for attempt in all_attempts:
                if attempt.subject not in attempts_by_subject:
                    attempts_by_subject[attempt.subject] = []
                attempts_by_subject[attempt.subject].append(attempt)
            
            # Calculate weakness score for each subject (matching frontend formula)
            import math
            subject_scores = []
            for subject in OFFICIAL_SUBJECTS:
                attempts = attempts_by_subject.get(subject, [])
                if attempts:
                    correct_count = sum(1 for a in attempts if a.is_correct)
                    total = len(attempts)
                    accuracy = (correct_count / total * 100) if total > 0 else 0
                    # Match frontend formula: (100 - accuracy) * Math.log1p(totalAttempted)
                    weakness_score = (100 - accuracy) * math.log1p(total)
                else:
                    weakness_score = 1000  # High score for subjects with no attempts
                
                subject_scores.append({
                    'subject': subject,
                    'weakness_score': weakness_score
                })
            
            # Sort by weakness score (highest = weakest = highest priority)
            subject_scores.sort(key=lambda x: x['weakness_score'], reverse=True)
            
            # Create SubjectPriority objects
            for idx, item in enumerate(subject_scores):
                SubjectPriority.objects.create(
                    subject=item['subject'],
                    priority_order=idx,
                    is_completed=False,
                    round_number=1
                )
            
            priorities = list(SubjectPriority.objects.all().order_by('priority_order'))
        else:
            # Sort existing priorities by priority_order
            priorities = sorted(priorities, key=lambda p: p.priority_order)
        
        serializer = self.get_serializer(priorities, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def reorder(self, request):
        """Bulk update priority order"""
        order_data = request.data.get('order', [])
        if not order_data:
            return Response({'error': 'order array required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update priority order for each subject
        for idx, subject_name in enumerate(order_data):
            try:
                priority = SubjectPriority.objects.get(subject=subject_name)
                priority.priority_order = idx
                priority.save()
            except SubjectPriority.DoesNotExist:
                # Create if doesn't exist
                SubjectPriority.objects.create(
                    subject=subject_name,
                    priority_order=idx,
                    is_completed=False,
                    round_number=1
                )
        
        # Return updated list
        priorities = SubjectPriority.objects.all().order_by('priority_order')
        serializer = self.get_serializer(priorities, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def toggle(self, request, subject=None):
        """Toggle completion status for a subject"""
        try:
            priority = SubjectPriority.objects.get(subject=subject)
            priority.is_completed = not priority.is_completed
            priority.save()
            serializer = self.get_serializer(priority)
            return Response(serializer.data)
        except SubjectPriority.DoesNotExist:
            return Response({'error': 'Subject priority not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['post'])
    def round_two(self, request):
        """Reset all completions and increment round number"""
        priorities = SubjectPriority.objects.all()
        max_round = max([p.round_number for p in priorities], default=1)
        
        for priority in priorities:
            priority.is_completed = False
            priority.round_number = max_round + 1
            priority.save()
        
        # Return updated list
        priorities = SubjectPriority.objects.all().order_by('priority_order')
        serializer = self.get_serializer(priorities, many=True)
        return Response(serializer.data)


class DebugViewSet(viewsets.ViewSet):
    """Debug endpoints for monitoring"""
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get table counts and connection status"""
        try:
            exam_count = Exam.objects.count()
            attempt_count = Attempt.objects.count()
            daily_plan_count = DailyPlan.objects.count()
            
            return Response({
                'connected': True,
                'tables': {
                    'exam': exam_count,
                    'attempt': attempt_count,
                    'daily_plan': daily_plan_count
                },
                'timestamp': timezone.now().isoformat()
            })
        except Exception as e:
            return Response({
                'connected': False,
                'error': str(e),
                'tables': {
                    'exam': 0,
                    'attempt': 0,
                    'daily_plan': 0
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnalyticsViewSet(viewsets.ViewSet):
    """Analytics endpoints"""
    
    @action(detail=False, methods=['get'])
    def subjects(self, request):
        """Calculate subject statistics"""
        all_attempts = Attempt.objects.all()
        subject_stats = {}
        
        # Initialize stats for all subjects
        for subject in OFFICIAL_SUBJECTS:
            subject_stats[subject] = {
                'subject': subject,
                'totalAttempted': 0,
                'correctCount': 0,
                'wrongCount': 0,
                'accuracy': 0,
                'status': 'N/A',
                'trend': []
            }
        
        # Group attempts by subject
        attempts_by_subject = {}
        for attempt in all_attempts:
            subject = attempt.subject
            if subject not in attempts_by_subject:
                attempts_by_subject[subject] = []
            attempts_by_subject[subject].append(attempt)
        
        # Calculate stats
        for subject in OFFICIAL_SUBJECTS:
            attempts = attempts_by_subject.get(subject, [])
            if attempts:
                correct_count = sum(1 for a in attempts if a.is_correct)
                total = len(attempts)
                accuracy = (correct_count / total * 100) if total > 0 else 0
                
                subject_stats[subject] = {
                    'subject': subject,
                    'totalAttempted': total,
                    'correctCount': correct_count,
                    'wrongCount': total - correct_count,
                    'accuracy': round(accuracy, 2),
                    'status': calculate_status(accuracy),
                    'trend': []  # Would need to calculate trend from timestamps
                }
        
        return Response(subject_stats)
    
    @action(detail=False, methods=['get'])
    def topics(self, request):
        """Calculate topic statistics for a subject"""
        subject = request.query_params.get('subject')
        if not subject:
            return Response({'error': 'subject parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        attempts = Attempt.objects.filter(subject=subject)
        topic_stats = {}
        
        for attempt in attempts:
            topic = attempt.topic or 'Unknown'
            if topic not in topic_stats:
                topic_stats[topic] = {
                    'topic': topic,
                    'totalAttempted': 0,
                    'correctCount': 0,
                    'wrongCount': 0,
                    'accuracy': 0,
                    'status': 'N/A'
                }
            
            topic_stats[topic]['totalAttempted'] += 1
            if attempt.is_correct:
                topic_stats[topic]['correctCount'] += 1
            else:
                topic_stats[topic]['wrongCount'] += 1
        
        # Calculate accuracy and status
        for topic, stats in topic_stats.items():
            if stats['totalAttempted'] > 0:
                stats['accuracy'] = round((stats['correctCount'] / stats['totalAttempted']) * 100, 2)
                stats['status'] = calculate_status(stats['accuracy'])
        
        return Response(list(topic_stats.values()))
    
    @action(detail=False, methods=['get'])
    def trend(self, request):
        """Calculate overall accuracy trend"""
        all_attempts = Attempt.objects.all().order_by('timestamp')
        
        # Group by date (using Ethiopian timezone with 6 AM day boundary)
        attempts_by_date = {}
        for attempt in all_attempts:
            # Use Ethiopian timezone to calculate date key
            date_key = get_ethiopian_date_key(attempt.timestamp)
            if date_key not in attempts_by_date:
                attempts_by_date[date_key] = {'correct': 0, 'total': 0}
            
            attempts_by_date[date_key]['total'] += 1
            if attempt.is_correct:
                attempts_by_date[date_key]['correct'] += 1
        
        # Calculate cumulative accuracy
        trend = []
        cumulative_correct = 0
        cumulative_total = 0
        
        for date_key in sorted(attempts_by_date.keys()):
            day_data = attempts_by_date[date_key]
            cumulative_correct += day_data['correct']
            cumulative_total += day_data['total']
            accuracy = (cumulative_correct / cumulative_total * 100) if cumulative_total > 0 else 0
            
            trend.append({
                'date': date_key,
                'dateDisplay': datetime.fromisoformat(date_key).strftime('%b %d'),
                'accuracy': round(accuracy, 2),
                'correct': cumulative_correct,
                'total': cumulative_total
            })
        
        return Response(trend)

