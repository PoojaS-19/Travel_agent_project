"""
Pydantic schemas for user authentication
"""
from pydantic import BaseModel, EmailStr
from typing import Optional


class UserSignup(BaseModel):
    """Schema for user signup"""
    username: str
    email: EmailStr
    password: str
    
    class Config:
        example = {
            "username": "john_doe",
            "email": "john@example.com",
            "password": "SecurePassword123!"
        }


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str
    
    class Config:
        example = {
            "email": "john@example.com",
            "password": "SecurePassword123!"
        }


class ForgotPasswordRequest(BaseModel):
    """Schema for requesting a password reset token"""
    email: EmailStr

    class Config:
        example = {
            "email": "john@example.com"
        }


class ForgotPasswordResponse(BaseModel):
    """Schema for password reset request response"""
    message: str
    reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    """Schema for resetting a password with a reset token"""
    email: EmailStr
    reset_token: str
    new_password: str

    class Config:
        example = {
            "email": "john@example.com",
            "reset_token": "abc123",
            "new_password": "NewSecurePassword123!"
        }


class UserResponse(BaseModel):
    """Schema for user response (without password)"""
    id: int
    username: str
    email: str
    created_at: str
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str
    user: UserResponse
    
    class Config:
        example = {
            "access_token": "eyJhbGc...",
            "token_type": "bearer",
            "user": {
                "id": 1,
                "username": "john_doe",
                "email": "john@example.com",
                "created_at": "2026-05-07T10:30:00"
            }
        }


class TokenData(BaseModel):
    """Schema for decoded token data"""
    user_id: Optional[int] = None


class ItineraryUpdate(BaseModel):
    """Schema for updating a saved itinerary"""
    start_city: Optional[str] = None
    destination: Optional[str] = None
    itinerary_text: Optional[str] = None
    daily_plans: Optional[list] = None
    language: Optional[str] = None


class ItineraryResponse(BaseModel):
    """Schema for saved itinerary response"""
    id: int
    start_city: Optional[str] = None
    destination: Optional[str] = None
    itinerary_text: Optional[str] = None
    daily_plans: Optional[list] = None
    language: Optional[str] = None
    created_at: str
