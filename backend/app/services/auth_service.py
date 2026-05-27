"""
Authentication service for password hashing and JWT token management
"""
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
import os
import secrets
from dotenv import load_dotenv

load_dotenv()

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
RESET_TOKEN_EXPIRE_MINUTES = 15
password_reset_tokens = {}
email_verification_codes = {}


class AuthService:
    """Handle password hashing and JWT token operations"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        password_bytes = password.encode("utf-8")[:72]
        return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        try:
            password_bytes = plain_password.encode("utf-8")[:72]
            return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
        """
        Create a JWT access token
        
        Args:
            data: Dictionary with user info (usually {"sub": user_id})
            expires_delta: Token expiration time (default: 30 minutes)
        
        Returns:
            JWT token string
        """
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def decode_token(token: str) -> dict:
        """
        Decode and validate a JWT token
        
        Args:
            token: JWT token string
        
        Returns:
            Decoded token data
        
        Raises:
            JWTError: If token is invalid or expired
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError as e:
            raise JWTError(f"Invalid token: {e}")

    @staticmethod
    def create_password_reset_token(email: str) -> str:
        """Create a short-lived password reset token for a user email"""
        token = secrets.token_urlsafe(32)
        password_reset_tokens[email] = {
            "token": token,
            "expires_at": datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
        }
        return token

    @staticmethod
    def verify_password_reset_token(email: str, token: str) -> bool:
        """Verify a password reset token and consume it when valid"""
        token_data = password_reset_tokens.get(email)
        if not token_data:
            return False

        if datetime.utcnow() > token_data["expires_at"]:
            password_reset_tokens.pop(email, None)
            return False

        if not secrets.compare_digest(token_data["token"], token):
            return False

        password_reset_tokens.pop(email, None)
        return True

    @staticmethod
    def generate_verification_code(email: str) -> str:
        """Generate a random 6-digit OTP and store it in memory"""
        import random
        code = f"{random.randint(100000, 999999)}"
        email_verification_codes[email] = code
        return code

    @staticmethod
    def verify_email_code(email: str, code: str) -> bool:
        """Verify the 6-digit OTP code for the email"""
        stored_code = email_verification_codes.get(email)
        if stored_code and stored_code == code:
            # Consume the code
            email_verification_codes.pop(email, None)
            return True
        return False
