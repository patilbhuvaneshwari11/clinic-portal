import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .db import get_db
from .models import User

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "medidesk-super-secret-production-jwt-key-391823791283")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours

http_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash password using standard bcrypt with 12 salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt or legacy pbkdf2 hash."""
    try:
        # Check standard bcrypt hash prefixes ($2b$, $2a$, $2y$)
        if hashed_password.startswith(("$2b$", "$2a$", "$2y$")):
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        # Fallback support for pbkdf2 format if database had existing entries: <salt_hex>$<hash_hex>
        if "$" in hashed_password:
            salt_hex, digest_hex = hashed_password.split("$", 1)
            import hashlib, hmac
            check = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), bytes.fromhex(salt_hex), 310_000).hex()
            return hmac.compare_digest(check, digest_hex)
        return False
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_EXPIRED", "message": "Access token has expired. Please log in again."}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid authentication token."}
        )


def current_user(
    req: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Extract authenticated user from JWT Bearer header or fallback cookie."""
    token: Optional[str] = None
    if auth_header and auth_header.credentials:
        token = auth_header.credentials
    elif "Authorization" in req.headers:
        parts = req.headers["Authorization"].split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    elif "clinic_token" in req.cookies:
        token = req.cookies.get("clinic_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHENTICATED", "message": "Missing authentication credentials."}
        )

    payload = decode_access_token(token)
    user_id = payload.get("sub") or payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid token subject."}
        )

    user = db.get(User, int(user_id))
    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_INACTIVE", "message": "User account does not exist or has been disabled."}
        )

    return user


def require(*roles: str):
    """RBAC dependency to ensure user has at least one of the specified roles."""
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": f"Access denied. Requires role: {', '.join(roles)}"}
            )
        return user
    return dep
