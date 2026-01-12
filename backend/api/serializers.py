from rest_framework import serializers
from .models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences


class QuestionSerializer(serializers.ModelSerializer):
    questionId = serializers.CharField(source='question_id', required=False, allow_blank=True, allow_null=True)
    correctAnswer = serializers.CharField(source='correct_answer')
    
    class Meta:
        model = Question
        fields = ['questionId', 'question', 'choices', 'correctAnswer', 'subject', 'topic', 'explanation']
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['questionId'] = instance.question_id
        data['correctAnswer'] = instance.correct_answer
        return data
    
    def create(self, validated_data):
        # Handle questionId - use provided or generate
        question_id = validated_data.pop('question_id', None)
        if not question_id:
            import uuid
            question_id = f"q_{uuid.uuid4().hex[:16]}"
        validated_data['question_id'] = question_id
        return super().create(validated_data)


class ExamSerializer(serializers.ModelSerializer):
    examId = serializers.CharField(source='exam_id', read_only=True)
    questionIds = serializers.ListField(source='question_ids', child=serializers.CharField())
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Exam
        fields = ['examId', 'title', 'questionIds', 'createdAt']


class AttemptSerializer(serializers.ModelSerializer):
    attemptId = serializers.CharField(source='attempt_id', read_only=True)
    questionId = serializers.CharField(source='question_id')
    selectedAnswer = serializers.CharField(source='selected_answer')
    isCorrect = serializers.BooleanField(source='is_correct')
    timeSpent = serializers.IntegerField(source='time_spent')
    examId = serializers.CharField(source='exam_id', required=False, allow_blank=True, allow_null=True)
    planDateKey = serializers.CharField(source='plan_date_key', required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = Attempt
        fields = ['attemptId', 'questionId', 'selectedAnswer', 'isCorrect', 'timeSpent', 
                  'subject', 'topic', 'examId', 'mode', 'planDateKey', 'timestamp']
        read_only_fields = ['attemptId', 'timestamp']
    
    def create(self, validated_data):
        # Generate attempt_id if not provided
        import uuid
        attempt_id = f"attempt_{uuid.uuid4().hex[:16]}"
        validated_data['attempt_id'] = attempt_id
        return super().create(validated_data)


class ExamSessionSerializer(serializers.ModelSerializer):
    sessionId = serializers.CharField(source='session_id', read_only=True)
    examId = serializers.CharField(source='exam_id', required=False, allow_blank=True, allow_null=True)
    currentIndex = serializers.IntegerField(source='current_index')
    questionIds = serializers.ListField(source='question_ids', child=serializers.CharField())
    isComplete = serializers.BooleanField(source='is_complete')
    isPaused = serializers.BooleanField(source='is_paused')
    timeSpent = serializers.DictField(source='time_spent', child=serializers.IntegerField())
    timePerQuestion = serializers.IntegerField(source='time_per_question', required=False, allow_null=True)
    planDateKey = serializers.CharField(source='plan_date_key', required=False, allow_blank=True, allow_null=True)
    startedAt = serializers.DateTimeField(source='started_at', read_only=True)
    lastUpdated = serializers.DateTimeField(source='last_updated', read_only=True)
    
    class Meta:
        model = ExamSession
        fields = ['sessionId', 'examId', 'mode', 'config', 'currentIndex', 'questionIds', 
                  'answers', 'timeSpent', 'isComplete', 'isPaused', 'timePerQuestion', 
                  'planDateKey', 'startedAt', 'lastUpdated']
        read_only_fields = ['sessionId', 'startedAt', 'lastUpdated']
    
    def create(self, validated_data):
        # Generate session_id if not provided
        import uuid
        from datetime import datetime
        session_id = f"session_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:9]}"
        validated_data['session_id'] = session_id
        return super().create(validated_data)


class DailyPlanSerializer(serializers.ModelSerializer):
    dateKey = serializers.CharField(source='date_key')
    focusSubject = serializers.CharField(source='focus_subject')
    totalAvailableInSubject = serializers.IntegerField(source='total_available_in_subject')
    maxPlannedQuestions = serializers.IntegerField(source='max_planned_questions')
    questionIds = serializers.ListField(source='question_ids', child=serializers.CharField())
    answeredCount = serializers.IntegerField(source='answered_count')
    correctCount = serializers.IntegerField(source='correct_count')
    wrongCount = serializers.IntegerField(source='wrong_count')
    isComplete = serializers.BooleanField(source='is_complete')
    motivationalQuote = serializers.CharField(source='motivational_quote', required=False, allow_blank=True, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    lastUpdated = serializers.DateTimeField(source='last_updated', read_only=True)
    
    class Meta:
        model = DailyPlan
        fields = ['dateKey', 'focusSubject', 'totalAvailableInSubject', 'maxPlannedQuestions', 
                  'questionIds', 'answeredCount', 'correctCount', 'wrongCount', 'accuracy', 
                  'isComplete', 'motivationalQuote', 'createdAt', 'lastUpdated']
        read_only_fields = ['dateKey', 'createdAt', 'lastUpdated']


class ThemePreferencesSerializer(serializers.ModelSerializer):
    favoriteLightTheme = serializers.CharField(source='favorite_light_theme')
    favoriteDarkTheme = serializers.CharField(source='favorite_dark_theme')
    autoMode = serializers.BooleanField(source='auto_mode')
    
    class Meta:
        model = ThemePreferences
        fields = ['id', 'favoriteLightTheme', 'favoriteDarkTheme', 'autoMode']

