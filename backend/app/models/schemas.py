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
