"""
Authentication endpoints for signup and login
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from jose import JWTError
from app.database import get_db
from app.models import User
from app.models.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    UserSignup,
    UserLogin,
    TokenResponse,
    UserResponse,
    SignupResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import AuthService
from app.services.collaboration_service import CollaborationService
from app.services.email_service import EmailService
from datetime import timedelta
from typing import Optional

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    """
    Extract and validate JWT token from Authorization header
    
    This is a dependency that protects endpoints requiring authentication
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from "Bearer <token>" format
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid authentication scheme")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = AuthService.decode_token(token)
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return int(user_id)
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    """
    Extract and validate JWT token if provided. Returns None when no auth header is present.
    """
    if not authorization:
        return None

    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            return None
    except ValueError:
        return None

    try:
        payload = AuthService.decode_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except JWTError:
        return None


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    """
    User signup endpoint
    
    Creates a new user and returns email verification details
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Hash password and create user
    hashed_password = AuthService.hash_password(user_data.password)
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        is_verified=False
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if user_data.invite_token:
        try:
            CollaborationService(db).accept_invitation(user_data.invite_token, new_user.id)
        except HTTPException:
            raise
        except Exception as invite_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Account created, but invite acceptance failed: {invite_error}"
            )
    
    # Generate verification code
    verification_code = AuthService.generate_verification_code(new_user.email)
    
    # Send actual email verification code via SMTP
    EmailService.send_verification_otp(new_user.email, verification_code)
    
    return SignupResponse(
        message="Verification code sent to your email. Please check your inbox.",
        verification_code="sent_to_email",
        email=new_user.email
    )


@router.post("/verify-email", response_model=TokenResponse)
def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)):
    """
    Verify user email using the 6-digit OTP code and log them in
    """
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email"
        )
    
    if user.is_verified:
        # Already verified, log them in
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id)},
            expires_delta=timedelta(minutes=30)
        )
        
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at.isoformat()
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
    
    # Verify code
    if not AuthService.verify_email_code(request.email, request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code"
        )
    
    # Set verified status
    user.is_verified = True
    db.commit()
    db.refresh(user)
    
    # Generate JWT token
    access_token = AuthService.create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=30)
    )
    
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at.isoformat()
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    User login endpoint
    
    Authenticates user and returns JWT token
    """
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not AuthService.verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if email is verified
    if not user.is_verified:
        # Generate new verification code
        verification_code = AuthService.generate_verification_code(user.email)
        # Send actual email verification code via SMTP
        EmailService.send_verification_otp(user.email, verification_code)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Email not verified. Please check your inbox for a verification code.",
                "verification_code": "sent_to_email",
                "email": user.email
            }
        )
    
    # Generate JWT token
    access_token = AuthService.create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=30)
    )
    
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at.isoformat()
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request a password reset token.

    In this demo project, the reset token is returned in the response because
    no email service is configured yet.
    """
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email"
        )

    reset_token = AuthService.create_password_reset_token(user.email)

    return ForgotPasswordResponse(
        message="Password reset code generated. Use it within 15 minutes.",
        reset_token=reset_token
    )


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset a user's password using a valid reset token.
    """
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )

    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email"
        )

    if not AuthService.verify_password_reset_token(user.email, request.reset_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code"
        )

    user.password_hash = AuthService.hash_password(request.new_password)
    db.commit()

    return {"message": "Password reset successfully. You can now log in."}


@router.get("/me", response_model=UserResponse)
def get_current_user(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """
    Get current authenticated user info
    
    Requires valid JWT token in Authorization header:
    Authorization: Bearer <token>
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at.isoformat()
    )
