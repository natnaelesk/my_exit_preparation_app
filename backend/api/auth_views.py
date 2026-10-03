from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from .serializers import SignupSerializer, UserSerializer


class AuthRateThrottle(SimpleRateThrottle):
    scope = 'auth'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


def _auth_response(user, status_code=status.HTTP_200_OK):
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data}, status=status_code)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return _auth_response(user, status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def login(request):
    username = str(request.data.get('username', '')).strip()
    password = request.data.get('password', '')
    if not username or not password:
        return Response({'error': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Usernames are unique case-insensitively (see SignupSerializer), so resolve the stored casing.
    match = get_user_model().objects.filter(username__iexact=username).first()
    user = authenticate(request, username=match.username if match else username, password=password)
    if user is None:
        return Response({'error': 'Invalid username or password.'}, status=status.HTTP_400_BAD_REQUEST)
    return _auth_response(user)


@api_view(['POST'])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def me(request):
    return Response(UserSerializer(request.user).data)
