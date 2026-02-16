import os
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form
from enum import Enum
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo
import socketio
import jwt
import base64

import json
import numpy as np
import bcrypt  # NEW: For password hashing
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # FIXED: Standard JWT header
from fastapi.staticfiles import StaticFiles
from typing import Dict
from uuid import uuid4
from enum import Enum
from pydantic import BaseModel

import secrets
import hashlib
from email.message import EmailMessage
import smtplib

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso_z(dt: datetime) -> str:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")



def as_utc(dt: datetime) -> datetime:
    """Convert mongo datetime (often naive UTC) into aware UTC datetime."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)  # treat naive as UTC (mongo default)
    return dt.astimezone(timezone.utc)

def serialize_dt(obj):
    if isinstance(obj, datetime):
        return iso_z(obj)
    if isinstance(obj, dict):
        return {k: serialize_dt(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize_dt(x) for x in obj]
    return obj


def mongo_serialize(obj):
    if isinstance(obj, Enum):
        return obj.value

    if isinstance(obj, BaseModel):
        return mongo_serialize(obj.dict())

    if isinstance(obj, dict):
        return {k: mongo_serialize(v) for k, v in obj.items()}

    if isinstance(obj, list):
        return [mongo_serialize(i) for i in obj]

    return obj

# JWT Config
SECRET_KEY = "your-very-secret-jwt-key-change-in-production"
ALGORITHM = "HS256"
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)
# Initialize FastAPI app
app = FastAPI(title="EmailProMax API", description="API for a secure email application with optional facial authentication")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["http://localhost:5173"]
)
socket_app = socketio.ASGIApp(sio)
@app.get("/")
async def root():
    return {"message": "Welcome to EmailProMax API"}
# MongoDB connection
MONGO_DETAILS = "mongodb+srv://darvy:darvy@cluster0.fbmfa52.mongodb.net/whisperMail"
client = AsyncIOMotorClient(
    MONGO_DETAILS,
    tz_aware=True,
    tzinfo=timezone.utc
)
database = client.emailpromax
# Collections
user_collection = database.get_collection("users")
email_collection = database.get_collection("emails")
contact_collection = database.get_collection("contacts")
folder_collection = database.get_collection("folders")
template_collection = database.get_collection("templates")
settings_collection = database.get_collection("settings")
analytics_collection = database.get_collection("analytics")
support_collection = database.get_collection("support_tickets")
starred_email_collection = database.get_collection("starred_emails")
trash_collection = database.get_collection("trash_emails")
password_reset_collection = database.get_collection("password_resets")
otp_collection = database.get_collection("password_otps")


# Security for JWT
security = HTTPBearer()  # NEW: Standard Bearer scheme
# Enums
class EmailType(str, Enum):
    INBOX = "inbox"
    SENT = "sent"
    DRAFT = "draft"
    STARRED = "starred"
    TRASH = "trash"
    SPAM = "spam"
    ARCHIVE = "archive"
class MessagePriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"
class MessageStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
class SecurityType(str, Enum):
    NONE = "none"
    ENCRYPTED = "encrypted"
    STEGANOGRAPHY = "steganography"
    BOTH = "both"
class ContactCategory(str, Enum):
    WORK = "work"
    BUSINESS = "business"
    PERSONAL = "personal"
    FAMILY = "family"
    FRIENDS = "friends"
# Pydantic Models
class EmailAttachment(BaseModel):
    filename: str = Field(..., max_length=255)
    file_url: str = Field(..., max_length=500)
    file_size: int
    file_type: str = Field(..., max_length=50)
    uploaded_at: datetime = Field(default_factory=now_utc)
     # 🔐 encryption metadata (OPTIONAL)
    encrypted: Optional[bool] = False
    iv: Optional[str] = None
    encrypted_keys: Optional[List[Dict[str, str]]] = None
    original_type: Optional[str] = None
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}
class EmailRecipient(BaseModel):
    email: str = Field(..., max_length=255)
    name: str = Field(..., max_length=100)
    type: str = Field("to", pattern="^(to|cc|bcc)$")
    status: MessageStatus = MessageStatus.SENT
    read_at: Optional[datetime] = None
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}
class Contact(BaseModel):
    name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    company: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    category: ContactCategory = ContactCategory.PERSONAL
    avatar_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=500)
    is_favorite: bool = False
    last_contacted: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}
class UserProfile(BaseModel):
    username: str = Field(..., max_length=50, min_length=3)
    name: str = Field(..., max_length=100, min_length=1)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[datetime] = None
    country: Optional[str] = Field(None, max_length=50)
    city: Optional[str] = Field(None, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    company: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    profile_picture_url: Optional[str] = Field(None, max_length=500)
    last_seen: datetime = Field(default_factory=now_utc)
    is_online: bool = False
    join_date: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    face_encoding: Optional[str] = None  # Optional now
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}
# NEW: Registration model
class UserRegister(BaseModel):
    username: str = Field(..., max_length=50, min_length=3)
    name: str = Field(..., max_length=100, min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)  # Enforce min pw length
# NEW: Login model
class UserLogin(BaseModel):
    username_or_email: str
    password: str
# NEW: Add face model
class AddFace(BaseModel):
    face_encoding: str
class SendEmail(BaseModel):  # FIXED: Separate model without sender_id
    subject: str = Field(..., max_length=255)
    body: str
    body_preview: Optional[str] = Field(None, max_length=200)
    recipients: List[EmailRecipient] = []
    type: EmailType = EmailType.INBOX
    priority: MessagePriority = MessagePriority.NORMAL
    security_type: SecurityType = SecurityType.NONE
    is_encrypted: bool = False
    is_steganography: bool = False
    attachments: List[EmailAttachment] = []
    in_reply_to: Optional[str] = None
    thread_id: Optional[str] = None
    is_read: bool = False
    is_starred: bool = False
    is_important: bool = False
    labels: List[str] = []
    scheduled_send: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    encrypted_body: Optional[str] = None
    encrypted_keys: Optional[List[Dict[str, str]]] = Field(
        None,
        description="List of {'user_id': str, 'encrypted_sym_key': str base64}"
    )
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}
# REMOVED: Redundant EmailMessage class (causing NameError)
class EmailFolder(BaseModel):
    name: str = Field(..., max_length=50)
    type: EmailType
    user_id: str
    description: Optional[str] = Field(None, max_length=200)
    color: Optional[str] = Field(None, max_length=7)
    icon: Optional[str] = Field(None, max_length=50)
    is_system: bool = True
    email_count: int = 0
    unread_count: int = 0
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}
class UserSettings(BaseModel):
    user_id: str
    email_notifications: bool = True
    push_notifications: bool = False
    desktop_notifications: bool = True
    sound_notifications: bool = True
    theme: str = Field("dark", pattern="^(dark|light|auto)$")
    language: str = "english"
    reading_pane: bool = True
    two_factor_auth: bool = False
    auto_logout: int = 30
    auto_save_drafts: bool = True
    auto_delete_trash: int = 30
    signature: Optional[str] = Field(None, max_length=1000)
    read_receipts: bool = True
    data_collection: bool = True
    personalized_ads: bool = False
    updated_at: datetime = Field(default_factory=now_utc)
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}
class SupportTicket(BaseModel):
    user_id: str
    subject: str = Field(..., max_length=255)
    description: str = Field(..., max_length=2000)
    category: str = Field(..., max_length=50)
    priority: MessagePriority = MessagePriority.NORMAL
    status: str = Field("open", pattern="^(open|in_progress|resolved|closed)$")
    attachments: List[EmailAttachment] = []
    assigned_to: Optional[str] = None
    resolution: Optional[str] = Field(None, max_length=1000)
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    resolved_at: Optional[datetime] = None
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: iso_z}



class SendOtpRequest(BaseModel):
    email: EmailStr

class VerifyOtpResetRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=8)
    new_password: str = Field(..., min_length=8)


def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


# Helper functions
def user_helper(user) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "name": user["name"],
        "email": user["email"],
        "phone": user.get("phone"),
        "date_of_birth": user.get("date_of_birth"),
        "country": user.get("country"),
        "city": user.get("city"),
        "bio": user.get("bio"),
        "company": user.get("company"),
        "position": user.get("position"),
        "profile_picture_url": user.get("profile_picture_url"),
        "last_seen": user["last_seen"],
        "is_online": user["is_online"],
        "join_date": user["join_date"],
        "updated_at": user["updated_at"],
        "face_encoding": user.get("face_encoding"),  # Optional
    }



def send_otp_email(to_email: str, otp_code: str):
    smtp_host = "smtp.gmail.com"
    smtp_port = 587
    smtp_user = "whispermails@gmail.com"
    smtp_pass = "uanflbbduqgvlnoi"   # Gmail App Password
    smtp_from = 'WhisperMail <whispermails@gmail.com>'

    if not smtp_user or not smtp_pass:
        print("📩 SMTP not configured. OTP:", otp_code)
        return

    msg = EmailMessage()
    msg["Subject"] = "WhisperMail Password Reset OTP"
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(
        "Hello,\n\n"
        f"Your OTP for password reset is: {otp_code}\n\n"
        "This OTP expires in 10 minutes.\n"
        "If you didn't request this, ignore this email.\n"
    )

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)

    print("✅ OTP email sent to:", to_email)



def send_reset_email(to_email: str, reset_link: str):
    smtp_host = "smtp.gmail.com"
    smtp_port = 587
    smtp_user = "whispermails@gmail.com"
    smtp_pass = "uanflbbduqgvlnoi"   # Gmail App Password
    smtp_from = 'WhisperMail <whispermails@gmail.com>'

    # ✅ If SMTP not configured, just print link (dev mode)
    if not smtp_host or not smtp_user or not smtp_pass or not smtp_from:
        print("📩 SMTP not configured. Reset link:", reset_link)
        return

    msg = EmailMessage()
    msg["Subject"] = "WhisperMail Password Reset"
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(
        "Hello,\n\n"
        f"Click this link to reset your password:\n{reset_link}\n\n"
        "If you didn't request this, ignore this email.\n"
        "This link expires in 15 minutes.\n"
    )

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)

    print("✅ Reset email sent to:", to_email)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

@app.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    # ✅ Always return success (don’t leak if email exists)
    user = await user_collection.find_one({"email": payload.email})

    if user:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_token(raw_token)
        expires_at = now_utc() + timedelta(minutes=15)

        await password_reset_collection.insert_one({
            "user_id": str(user["_id"]),
            "email": payload.email,
            "token_hash": token_hash,
            "expires_at": expires_at,
            "used": False,
            "created_at": now_utc()
        })

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{frontend_url}/reset-password?token={raw_token}"
        send_reset_email(payload.email, reset_link)

    return {"message": "If that email exists, a reset link has been sent."}


@app.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    token_hash = hash_token(payload.token)

    record = await password_reset_collection.find_one({
        "token_hash": token_hash,
        "used": False
    })

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or used reset token")

    if record["expires_at"] < now_utc():
        raise HTTPException(status_code=400, detail="Reset token expired")

    # ✅ Update password
    new_hash = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    await user_collection.update_one(
        {"_id": ObjectId(record["user_id"])},
        {"$set": {"password_hash": new_hash, "updated_at": now_utc()}}
    )

    # ✅ Mark token used
    await password_reset_collection.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )

    return {"message": "Password reset successful"}



@app.post("/forgot-password-otp")
async def forgot_password_otp(payload: SendOtpRequest):
    # ✅ Always return success (don’t leak if email exists)
    user = await user_collection.find_one({"email": payload.email})

    if user:
        # Optional: rate limit (simple)
        ten_min_ago = now_utc() - timedelta(minutes=10)
        recent = await otp_collection.count_documents({
            "email": payload.email,
            "created_at": {"$gte": ten_min_ago}
        })
        if recent >= 3:
            # still return success (avoid leaking), but do nothing
            return {"message": "If that email exists, an OTP has been sent."}

        otp_code = f"{secrets.randbelow(1000000):06d}"  # 6-digit OTP
        otp_hash = hash_otp(otp_code)
        expires_at = now_utc() + timedelta(minutes=10)

        # Invalidate previous unused OTPs for this email (optional)
        await otp_collection.update_many(
            {"email": payload.email, "used": False},
            {"$set": {"used": True, "used_at": now_utc(), "reason": "new_otp_issued"}}
        )

        await otp_collection.insert_one({
            "user_id": str(user["_id"]),
            "email": payload.email,
            "otp_hash": otp_hash,
            "expires_at": expires_at,
            "used": False,
            "created_at": now_utc()
        })

        send_otp_email(payload.email, otp_code)

    return {"message": "If that email exists, an OTP has been sent."}


@app.post("/reset-password-otp")
async def reset_password_otp(payload: VerifyOtpResetRequest):
    otp_hash = hash_otp(payload.otp)

    record = await otp_collection.find_one({
        "email": payload.email,
        "otp_hash": otp_hash,
        "used": False
    })

    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if as_utc(record["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="OTP expired")

    # ✅ Update password
    new_hash = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    await user_collection.update_one(
        {"_id": ObjectId(record["user_id"])},
        {"$set": {"password_hash": new_hash, "updated_at": now_utc()}}
    )

    # ✅ Mark OTP used
    await otp_collection.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "used_at": now_utc()}}
    )

    return {"message": "Password reset successful"}


async def get_user_brief(user_id: str):
    user = await user_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"name": "Unknown", "email": "unknown@example.com"}
    return {
        "name": user.get("name", "Unknown"),
        "email": user.get("email", "unknown@example.com")
    }



async def email_helper(email) -> dict:
    sender = await get_user_brief(email["sender_id"])

    data = {
        "id": str(email["_id"]),
        "subject": email["subject"],
        "body": email["body"] if email.get("is_encrypted") in [False, None] else None,
        "body_preview": email.get("body_preview"),
        "encrypted_body": email.get("encrypted_body"),
        "encrypted_keys": email.get("encrypted_keys"),
        "sender_id": email["sender_id"],
        "sender_name": sender["name"],
        "sender_email": sender["email"],
        "recipients": email.get("recipients", []),
        "type": email.get("type", EmailType.INBOX),
        "priority": email.get("priority", MessagePriority.NORMAL),
        "security_type": email.get("security_type"),
        "is_encrypted": email.get("is_encrypted", False),
        "is_steganography": email.get("is_steganography", False),
        "attachments": email.get("attachments", []),
        "is_read": email.get("is_read", False),
        "is_starred": email.get("is_starred", False),
        "is_important": email.get("is_important", False),
        "labels": email.get("labels", []),

        # ✅ force Z strings
        "sent_at": email.get("sent_at"),
        "created_at": email.get("created_at"),
        "updated_at": email.get("updated_at"),
        "read_at": email.get("read_at"),
        "delivered_at": email.get("delivered_at"),
    }

    return serialize_dt(data)

def contact_helper(contact) -> dict:
    return serialize_dt({
        "id": str(contact["_id"]),
        "name": contact["name"],
        "email": contact["email"],
        "phone": contact.get("phone"),
        "company": contact.get("company"),
        "position": contact.get("position"),
        "category": contact["category"],
        "avatar_url": contact.get("avatar_url"),
        "notes": contact.get("notes"),
        "is_favorite": contact.get("is_favorite", False),
        "last_contacted": contact.get("last_contacted"),
        "created_at": contact.get("created_at"),
        "updated_at": contact.get("updated_at"),
    })


def settings_helper(settings) -> dict:
    if not settings:
        return {}
    return serialize_dt({
        "user_id": settings["user_id"],
        "email_notifications": settings.get("email_notifications", True),
        "push_notifications": settings.get("push_notifications", False),
        "desktop_notifications": settings.get("desktop_notifications", True),
        "sound_notifications": settings.get("sound_notifications", True),
        "theme": settings.get("theme", "dark"),
        "language": settings.get("language", "english"),
        "reading_pane": settings.get("reading_pane", True),
        "two_factor_auth": settings.get("two_factor_auth", False),
        "auto_logout": settings.get("auto_logout", 30),
        "auto_save_drafts": settings.get("auto_save_drafts", True),
        "auto_delete_trash": settings.get("auto_delete_trash", 30),
        "signature": settings.get("signature"),
        "read_receipts": settings.get("read_receipts", True),
        "data_collection": settings.get("data_collection", True),
        "personalized_ads": settings.get("personalized_ads", False),
        "updated_at": settings.get("updated_at"),
    })







def decode_face_encoding(face_b64: str) -> np.ndarray:
    """
    Supports 2 formats:
    1) NEW (recommended): base64(raw Float32Array bytes) -> 512 bytes (128 * 4)
    2) OLD: base64(json string of 128 floats) or base64(json dict {"0":..})
    """
    raw = base64.b64decode(face_b64)

    # --- Try NEW binary float32 format first ---
    if len(raw) % 4 == 0:
        arr = np.frombuffer(raw, dtype=np.float32)
        if arr.size == 128:
            return arr.astype(np.float32)

    # --- Fallback: OLD json format ---
    try:
        txt = raw.decode("utf-8")
        data = json.loads(txt)

        if isinstance(data, dict):
            # dict like {"0":0.1,"1":0.2,...}
            data = [data[str(i)] for i in range(len(data))]

        arr = np.array(data, dtype=np.float32)
        if arr.size != 128:
            raise ValueError(f"Invalid JSON descriptor length: {arr.size}")
        return arr
    except Exception as e:
        raise ValueError(f"Invalid face encoding format: {e}")
    

def verify_face(image_base64: str, stored_encoding: str) -> bool:
    try:
        received_encoding = decode_face_encoding(image_base64)
        stored_encoding_data = decode_face_encoding(stored_encoding)

        distance = np.linalg.norm(received_encoding - stored_encoding_data)
        print(f"📏 Face match distance: {distance}")
        return distance < 0.5
    except Exception as e:
        print(f"⚠️ Face verification error: {e}")
        return False




def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    




class PublicKeyResponse(BaseModel):
    user_id: str
    public_key: str

@app.get("/public-key/{email}", response_model=PublicKeyResponse)
async def get_public_key(email: str):
    """Public endpoint — no auth needed (public keys are public)."""
    user = await user_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    public_key = user.get("public_key")
    if not public_key:
        raise HTTPException(status_code=404, detail="Recipient does not have encryption enabled (no public key)")
    return {"user_id": str(user["_id"]), "public_key": public_key}

@app.post("/set-public-key")
async def set_public_key(payload: dict, current_user: str = Depends(get_current_user)):
    public_key = payload.get("public_key")
    if not public_key:
        raise HTTPException(status_code=400, detail="public_key required")
    await user_collection.update_one(
        {"username": current_user},
        {"$set": {"public_key": public_key, "updated_at": now_utc()}}
    )
    return {"message": "Public key updated"}
    
ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "audio/webm",
    "audio/wav",
    "audio/mpeg",
    "audio/mp3",
    "application/pdf",
    "application/octet-stream",  # ✅ encrypted audio
}


MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# @app.post("/upload")
# async def upload_file(file: UploadFile = File(...)):
#     # FIXED: Create uploads dir if not exists
#     os.makedirs("uploads", exist_ok=True)
    
#     if not file.filename:
#         raise HTTPException(status_code=400, detail="No file provided")
    
#     file_location = f"uploads/{file.filename}"
    
#     try:
#         content = await file.read()
#         with open(file_location, "wb") as f:
#             f.write(content)
#         return {"file_url": file_location}
#     except Exception as exc:
#         print(f"💥 Upload error: {exc}")
#         raise HTTPException(status_code=500, detail="Failed to upload file")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    ext = os.path.splitext(file.filename)[1]
    safe_name = f"{uuid4().hex}{ext}"
    file_path = os.path.join(UPLOADS_DIR, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "file_url": f"uploads/{safe_name}",
        "file_type": file.content_type,
        "file_size": len(content),
    }

# NEW: Normal Registration Endpoint
@app.post("/register")
async def register(user_data: UserRegister):
    """Register a new user with email/password (face optional later)."""
    # Hash password
    password_hash = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    existing = await user_collection.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]})
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    user_dict = {
        "username": user_data.username,
        "name": user_data.name,
        "email": user_data.email,
        "password_hash": password_hash.decode('utf-8'),  # Store as str
        "face_encoding": None,  # Optional, add later
        "last_seen": now_utc(),
        "is_online": False,
        "join_date": now_utc(),
        "updated_at": now_utc()
    }
    result = await user_collection.insert_one(user_dict)
    if result.inserted_id:
        # Create default settings for user
        settings_dict = {
            "user_id": str(result.inserted_id),
            "updated_at": now_utc()
        }
        await settings_collection.insert_one(settings_dict)
       
        # Create default folders
        default_folders = [
            {"name": "Inbox", "type": EmailType.INBOX, "user_id": str(result.inserted_id), "is_system": True},
            {"name": "Sent", "type": EmailType.SENT, "user_id": str(result.inserted_id), "is_system": True},
            {"name": "Drafts", "type": EmailType.DRAFT, "user_id": str(result.inserted_id), "is_system": True},
            {"name": "Starred", "type": EmailType.STARRED, "user_id": str(result.inserted_id), "is_system": True},
            {"name": "Trash", "type": EmailType.TRASH, "user_id": str(result.inserted_id), "is_system": True},
            {"name": "Spam", "type": EmailType.SPAM, "user_id": str(result.inserted_id), "is_system": True},
            {"name": "Archive", "type": EmailType.ARCHIVE, "user_id": str(result.inserted_id), "is_system": True},
        ]
        await folder_collection.insert_many(default_folders)
       
        return {"message": "User registered successfully"}
    else:
        raise HTTPException(status_code=500, detail="Registration failed")
# NEW: Normal Login Endpoint







# ---------- Response Models ----------
class ActivityItem(BaseModel):
    type: str                 # "sent" | "starred" | "contact"
    label: str                # "Sent to X" etc
    timestamp: Optional[datetime] = None

class RecentActivityResponse(BaseModel):
    items: List[ActivityItem] = []

class StorageResponse(BaseModel):
    used_bytes: int
    quota_bytes: int
    used_percent: float

# ---------- Helpers ----------
def safe_dt(v):
    return v if isinstance(v, datetime) else None

# ---------- Dashboard: Recent Activity ----------
@app.get("/dashboard/recent-activity", response_model=RecentActivityResponse)
async def dashboard_recent_activity(current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    uid = str(user["_id"])
    uemail = user["email"]

    items: List[ActivityItem] = []

    # 1) Latest sent email
    sent = await email_collection.find({
        "sender_id": uid,
        "type": EmailType.SENT
    }).sort("sent_at", -1).limit(1).to_list(length=1)

    if sent:
        e = sent[0]
        # Try to show recipient name/email
        rec = (e.get("recipients") or [])
        to_label = "someone"
        if len(rec) > 0:
            to_label = rec[0].get("name") or rec[0].get("email") or "someone"
        items.append(ActivityItem(
            type="sent",
            label=f"Sent to {to_label}",
            timestamp=safe_dt(e.get("sent_at") or e.get("created_at"))
        ))

    # 2) Latest starred email (by this user view)
    starred = await email_collection.find({
        "$and": [
            {"is_starred": True},
            {"type": {"$nin": [EmailType.TRASH, EmailType.SPAM]}},
            {"$or": [
                {"sender_id": uid},
                {"recipients.email": uemail}
            ]}
        ]
    }).sort("updated_at", -1).limit(1).to_list(length=1)

    if starred:
        e = starred[0]
        items.append(ActivityItem(
            type="starred",
            label="Starred message",
            timestamp=safe_dt(e.get("updated_at") or e.get("created_at"))
        ))

    # 3) Latest added/updated contact
    contact = await contact_collection.find({
        "user_id": uid
    }).sort("updated_at", -1).limit(1).to_list(length=1)

    if contact:
        c = contact[0]
        name = c.get("name") or "contact"
        items.append(ActivityItem(
            type="contact",
            label=f"Added contact: {name}",
            timestamp=safe_dt(c.get("updated_at") or c.get("created_at"))
        ))

    # Sort all by time desc (sent/starred/contact mixed)
    items_sorted = sorted(items, key=lambda x: x.timestamp or datetime.min, reverse=True)

    return {"items": items_sorted}


# ---------- Dashboard: Storage ----------
@app.get("/dashboard/storage", response_model=StorageResponse)
async def dashboard_storage(current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    uid = str(user["_id"])
    uemail = user["email"]

    # Sum attachment file_size for emails accessible to this user (sent + received + trash)
    cursor = email_collection.find({
        "$or": [
            {"sender_id": uid},
            {"recipients.email": uemail}
        ]
    }, {"attachments": 1})

    used = 0
    async for doc in cursor:
        atts = doc.get("attachments") or []
        for a in atts:
            size = a.get("file_size") or 0
            if isinstance(size, int) and size > 0:
                used += size

    quota = 20 * 1024 * 1024 * 1024  # 20 GB
    percent = (used / quota) * 100 if quota else 0.0

    return {
        "used_bytes": used,
        "quota_bytes": quota,
        "used_percent": round(percent, 2)
    }







@app.post("/login")
async def login(credentials: UserLogin):
    """Login using username/email and password."""
    user = await user_collection.find_one({"$or": [{"username": credentials.username_or_email}, {"email": credentials.username_or_email}]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Verify password
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid password")
    # Update user online status
    await user_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_online": True, "last_seen": now_utc()}}
    )
    token = jwt.encode(
        {"sub": user["username"], "exp": now_utc() + timedelta(hours=24)},
        SECRET_KEY,
        algorithm=ALGORITHM
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_helper(user)
    }
# # NEW: Optional Face Addition Endpoint
# @app.post("/add-face")
# async def add_face(face_data: AddFace, current_user: str = Depends(get_current_user)):
#     """Add facial encoding to existing user account (optional)."""
#     user = await user_collection.find_one({"username": current_user})
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
#     # Optional: Verify if face is valid (e.g., non-empty), but skip for now
#     await user_collection.update_one(
#         {"_id": user["_id"]},
#         {"$set": {"face_encoding": face_data.face_encoding, "updated_at": now_utc()}}
#     )
#     return {"message": "Face encoding added successfully"}


@app.post("/add-face")
async def add_face(face_data: AddFace, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("face_encoding"):
        raise HTTPException(
            status_code=409,
            detail="Facial authentication already enabled. Remove existing face to add a new one."
        )

    # ✅ validate (auto-detect format)
    try:
        arr = decode_face_encoding(face_data.face_encoding)
        if arr.size != 128:
            raise ValueError("Descriptor must be 128 floats")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid face encoding")

    await user_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"face_encoding": face_data.face_encoding, "updated_at": now_utc()}}
    )

    return {"message": "Face authentication enabled"}

@app.post("/face-login")
async def face_login(credentials: dict):
    identifier = credentials.get("username_or_email") or credentials.get("username")
    face_encoding = credentials.get("face_encoding")

    if not identifier or not face_encoding:
        raise HTTPException(status_code=400, detail="username_or_email and face_encoding required")

    user = await user_collection.find_one({
        "$or": [{"username": identifier}, {"email": identifier}]
    })

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.get("face_encoding"):
        raise HTTPException(status_code=400, detail="No face registered for this user. Add it via /add-face first.")

    if not verify_face(face_encoding, user["face_encoding"]):
        raise HTTPException(status_code=401, detail="Face authentication failed")

    await user_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_online": True, "last_seen": now_utc()}}
    )

    token = jwt.encode(
        {"sub": user["username"], "exp": now_utc() + timedelta(hours=24)},
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_helper(user)
    }


# # Email Endpoints (Updated to use SendEmail)
# @app.post("/emails/send")
# async def send_email(email: SendEmail, current_user: str = Depends(get_current_user)):
#     """Send a new email."""
#     user = await user_collection.find_one({"username": current_user})
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
    
#     try:
#         email_dict = email.dict()
#         email_dict["sender_id"] = str(user["_id"])  # Set server-side
#         email_dict["sent_at"] = now_utc()
#         email_dict["type"] = EmailType.SENT
#         email_dict["created_at"] = now_utc()
#         email_dict["updated_at"] = now_utc()
#         email_dict["security_type"] = email.security_type
#         email_dict["is_encrypted"] = (email.security_type in ["encrypted", "both"])
#         email_dict["is_steganography"] = (email.security_type in ["steganography", "both"])
        
#         # Insert into "Sent"
#         result = await email_collection.insert_one(email_dict)
#         if not result.inserted_id:
#             raise HTTPException(status_code=500, detail="Failed to send email")

#         # Insert into each recipient inbox
#         for recipient in email.recipients:
#             inbox_email = email_dict.copy()
#             inbox_email["type"] = EmailType.INBOX
#             inbox_email["is_read"] = False
#             inbox_email["_id"] = ObjectId()
#             await email_collection.insert_one(inbox_email)

#         # Return the final stored email with sender name & email populated
#         sent_email = await email_collection.find_one({"_id": result.inserted_id})
#         return await email_helper(sent_email)   # ✅ FIXED
        
#     except Exception as exc:
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"Internal server error: {str(exc)}")


@app.post("/emails/send")
async def send_email(email: SendEmail, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        now = now_utc()  # ✅ current time (server)
        email_dict = mongo_serialize(email.dict())

        email_dict["sender_id"] = str(user["_id"])
        email_dict["type"] = EmailType.SENT

        # ✅ timestamps
        email_dict["created_at"] = now
        email_dict["updated_at"] = now
        email_dict["sent_at"] = now

        # Handle encryption
        if email.security_type in [SecurityType.ENCRYPTED, SecurityType.BOTH]:
            if not email.encrypted_body or not email.encrypted_keys:
                raise HTTPException(status_code=422, detail="encrypted_body and encrypted_keys are required for encrypted emails")
            email_dict["encrypted_body"] = email.encrypted_body
            email_dict["encrypted_keys"] = email.encrypted_keys
            email_dict["body"] = "[Encrypted content]"
            email_dict["body_preview"] = "Encrypted message"
            email_dict["is_encrypted"] = True
        else:
            email_dict["body"] = email.body
            email_dict["body_preview"] = email.body_preview or email.body[:200]
            email_dict["is_encrypted"] = False

        email_dict["is_steganography"] = (email.security_type in [SecurityType.STEGANOGRAPHY, SecurityType.BOTH])

        # ✅ Insert into Sent
        result = await email_collection.insert_one(email_dict)
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to send email")

        # ✅ Insert copies into recipients' inboxes with new timestamps
        for recipient in email.recipients:
            inbox_email = email_dict.copy()
            inbox_email["_id"] = ObjectId()
            inbox_email["type"] = EmailType.INBOX
            inbox_email["is_read"] = False

            # ✅ Keep same sent time, but created_at is also now
            inbox_email["created_at"] = now
            inbox_email["updated_at"] = now
            inbox_email["sent_at"] = now

            await email_collection.insert_one(inbox_email)

        sent_email = await email_collection.find_one({"_id": result.inserted_id})
        return await email_helper(sent_email)

    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(exc)}")

    
@app.get("/emails/inbox")
async def get_inbox_emails(current_user: str = Depends(get_current_user), skip: int = 0, limit: int = 50):
    """Get inbox emails for current user."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    emails = await email_collection.find({
        "recipients.email": user["email"],
        "type": EmailType.INBOX
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
   
    return [await email_helper(email) for email in emails]
@app.get("/emails/sent")
async def get_sent_emails(current_user: str = Depends(get_current_user), skip: int = 0, limit: int = 50):
    """Get sent emails for current user."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    emails = await email_collection.find({
        "sender_id": str(user["_id"]),
        "type": EmailType.SENT
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
   
    return [await email_helper(email) for email in emails]
@app.get("/emails/starred")
async def get_starred_emails(current_user: str = Depends(get_current_user), skip: int = 0, limit: int = 50):
    """Get starred emails for current user (FIXED: Exclude trash/spam)."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    emails = await email_collection.find({
        "$and": [
            {"$or": [
                {"sender_id": str(user["_id"]), "is_starred": True},
                {"recipients.email": user["email"], "is_starred": True}
            ]},
            {"type": {"$nin": [EmailType.TRASH, EmailType.SPAM]}}
        ]
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
   
    return [await email_helper(email) for email in emails]
@app.post("/emails/{email_id}/star")
async def star_email(email_id: str, current_user: str = Depends(get_current_user)):
    """Star/unstar an email."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    email = await email_collection.find_one({"_id": ObjectId(email_id)})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    await email_collection.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {"is_starred": not email.get("is_starred", False), "updated_at": now_utc()}}
    )
    return {"message": "Email starred status updated"}
@app.post("/emails/{email_id}/read")
async def mark_email_read(email_id: str, current_user: str = Depends(get_current_user)):
    """Mark an email as read."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await email_collection.update_one(
        {"_id": ObjectId(email_id), "recipients.email": user["email"]},
        {"$set": {"is_read": True, "read_at": now_utc(), "updated_at": now_utc()}}
    )
    return {"message": "Email marked as read"}
@app.delete("/emails/{email_id}")
async def delete_email(email_id: str, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = await email_collection.find_one({"_id": ObjectId(email_id)})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    # Determine what folder this email was in FROM CURRENT USER'S VIEW
    user_view_folder = EmailType.TRASH
    if email["sender_id"] == str(user["_id"]):
        if email["type"] == EmailType.SENT:
            user_view_folder = EmailType.SENT
        elif email["type"] == EmailType.DRAFT:
            user_view_folder = EmailType.DRAFT
    elif any(r["email"] == user["email"] for r in email["recipients"]):
        if email["type"] == EmailType.INBOX:
            user_view_folder = EmailType.INBOX
        elif email["type"] == EmailType.SPAM:
            user_view_folder = EmailType.SPAM

    # Move to trash (shared document)
    await email_collection.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {"type": EmailType.TRASH, "updated_at": now_utc()}}
    )

    # Store PER-USER trash info
    trash_dict = {
        "user_id": str(user["_id"]),
        "email_id": email_id,
        "original_folder": user_view_folder.value,  # <-- THIS is key!
        "deleted_at": now_utc(),
        "permanent_delete_at": now_utc() + timedelta(days=30)
    }
    await trash_collection.replace_one(
        {"user_id": str(user["_id"]), "email_id": email_id},
        trash_dict,
        upsert=True
    )
    return {"message": "Email moved to trash"}
# NEW: Trash endpoints
@app.get("/emails/trash")
async def get_trash_emails(
    current_user: str = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50
):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    emails = await email_collection.find({
        "type": EmailType.TRASH,
        "$or": [
            {"sender_id": str(user["_id"])},
            {"recipients.email": user["email"]}
        ]
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)

    # ✅ CRITICAL FIX
    result = []
    for email in emails:
        result.append(await email_helper(email))

    return result


@app.delete("/emails/trash/empty")
async def empty_trash(current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all trash emails for this user
    user_trash = await trash_collection.find({"user_id": str(user["_id"])}).to_list(None)
    deleted_count = 0

    for trash in user_trash:
        email_id = trash["email_id"]
        remaining = await trash_collection.count_documents({
            "email_id": email_id,
            "user_id": {"$ne": str(user["_id"])}
        })

        if remaining == 0:
            await email_collection.delete_one({"_id": ObjectId(email_id)})
        deleted_count += 1

    await trash_collection.delete_many({"user_id": str(user["_id"])})
    return {"deleted_count": deleted_count}
# Restore email from trash
@app.patch("/emails/{email_id}/restore")
async def restore_email(email_id: str, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = await email_collection.find_one({"_id": ObjectId(email_id)})
    if not email or email["type"] != EmailType.TRASH:
        raise HTTPException(status_code=404, detail="Email not in trash")

    # Get USER-SPECIFIC original folder
    trash_record = await trash_collection.find_one({
        "user_id": str(user["_id"]),
        "email_id": email_id
    })
    if not trash_record:
        raise HTTPException(status_code=404, detail="Trash record not found")

    original_folder = trash_record.get("original_folder", "inbox")

    # Restore to correct folder
    await email_collection.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {
            "type": original_folder,
            "updated_at": now_utc(),
            "is_read": original_folder == "inbox"  # optional: mark unread if restored to inbox
        }}
    )

    # Remove from user's trash
    await trash_collection.delete_one({"user_id": str(user["_id"]), "email_id": email_id})

    return {"message": f"Email restored to {original_folder}"}
# Permanent delete
@app.delete("/emails/{email_id}/permanent")
async def permanent_delete(email_id: str, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = await email_collection.find_one({"_id": ObjectId(email_id)})
    if not email or email["type"] != EmailType.TRASH:
        raise HTTPException(status_code=404, detail="Email not in trash")

    # Check if ANY user still has it in trash
    remaining_trash = await trash_collection.count_documents({
        "email_id": email_id,
        "user_id": {"$ne": str(user["_id"])}
    })

    # Remove from this user's trash
    await trash_collection.delete_one({
        "user_id": str(user["_id"]),
        "email_id": email_id
    })

    # If no one else has it in trash → delete permanently
    if remaining_trash == 0:
        await email_collection.delete_one({"_id": ObjectId(email_id)})
        return {"message": "Email permanently deleted"}
    else:
        return {"message": "Email removed from your trash (still in others')"}
# Contact Endpoints
@app.post("/contacts")
async def create_contact(contact: Contact, current_user: str = Depends(get_current_user)):
    """Create a new contact."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    contact_dict = contact.dict()
    contact_dict["user_id"] = str(user["_id"])
    contact_dict["created_at"] = now_utc()
    contact_dict["updated_at"] = now_utc()
    result = await contact_collection.insert_one(contact_dict)
    if result.inserted_id:
        created_contact = await contact_collection.find_one({"_id": result.inserted_id})
        return contact_helper(created_contact)
    raise HTTPException(status_code=500, detail="Failed to create contact")
@app.get("/contacts")
async def get_contacts(current_user: str = Depends(get_current_user), category: Optional[str] = None, skip: int = 0, limit: int = 50):  # FIXED: Add pagination
    """Get all contacts for current user."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    query = {"user_id": str(user["_id"])}
    if category:
        query["category"] = category
    contacts = await contact_collection.find(query).sort("name", 1).skip(skip).limit(limit).to_list(length=limit)
    return [contact_helper(contact) for contact in contacts]
@app.put("/contacts/{contact_id}")
async def update_contact(contact_id: str, contact: Contact, current_user: str = Depends(get_current_user)):
    """Update a contact."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    contact_dict = contact.dict()
    contact_dict["updated_at"] = now_utc()
    result = await contact_collection.update_one(
        {"_id": ObjectId(contact_id), "user_id": str(user["_id"])},
        {"$set": contact_dict}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    updated_contact = await contact_collection.find_one({"_id": ObjectId(contact_id)})
    return contact_helper(updated_contact)
@app.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, current_user: str = Depends(get_current_user)):
    """Delete a contact."""
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    result = await contact_collection.delete_one({"_id": ObjectId(contact_id), "user_id": str(user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted successfully"}
# Settings Endpoints (FIXED: Exclude client user_id)
@app.get("/settings")
async def get_settings(current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    settings = await settings_collection.find_one({"user_id": str(user["_id"])})
    
    if not settings:
        # Create default settings
        default_settings = {
            "user_id": str(user["_id"]),
            "updated_at": now_utc()
        }
        await settings_collection.insert_one(default_settings)
        settings = default_settings

    return settings_helper(settings)  # ← NOW SAFE! No ObjectId
@app.put("/settings")
async def update_settings(settings: UserSettings, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    settings_dict = settings.dict(exclude_unset=True)
    settings_dict.pop("user_id", None)
    settings_dict["user_id"] = str(user["_id"])
    settings_dict["updated_at"] = now_utc()

    result = await settings_collection.update_one(
        {"user_id": str(user["_id"])},
        {"$set": settings_dict},
        upsert=True
    )

    updated_settings = await settings_collection.find_one({"user_id": str(user["_id"])})
    return settings_helper(updated_settings)  # ← Return clean dict

class SupportTicketCreate(BaseModel):
    subject: str = Field(..., max_length=255)
    message: str = Field(..., max_length=2000)
    category: str = Field("general", max_length=50)   # default
    priority: MessagePriority = MessagePriority.NORMAL

@app.post("/support")
async def create_support_ticket(payload: SupportTicketCreate, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ticket_dict = {
        "user_id": str(user["_id"]),
        "subject": payload.subject,
        "description": payload.message,   # ✅ map message -> description
        "category": payload.category,
        "priority": payload.priority,
        "status": "open",
        "attachments": [],
        "assigned_to": None,
        "resolution": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
        "resolved_at": None,
    }

    result = await support_collection.insert_one(ticket_dict)
    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="Failed to create support ticket")

    return {"message": "Support ticket created successfully"}

@app.get("/analytics")
async def get_analytics(current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = now_utc()
    user_id = str(user["_id"])
    user_email = user["email"]

    # ✅ Scope: emails where user is sender OR recipient
    base_scope = {
        "$or": [
            {"sender_id": user_id},
            {"recipients.email": user_email}
        ]
    }

    # ----------------------------
    # Distribution (folder counts)
    # ----------------------------
    inbox_count = await email_collection.count_documents({
        "recipients.email": user_email,
        "type": EmailType.INBOX
    })

    sent_count = await email_collection.count_documents({
        "sender_id": user_id,
        "type": EmailType.SENT
    })

    trash_count = await email_collection.count_documents({
        "type": EmailType.TRASH,
        "$or": [
            {"sender_id": user_id},
            {"recipients.email": user_email}
        ]
    })

    # ✅ Starred is a FLAG (overlaps inbox/sent), so keep it separate
    starred_count = await email_collection.count_documents({
        "$and": [
            {"is_starred": True},
            {"type": {"$nin": [EmailType.TRASH, EmailType.SPAM]}},
            base_scope
        ]
    })

    # ----------------------------
    # Activity (unique mail counts)
    # ----------------------------
    def time_filter(days: int):
        return {"created_at": {"$gte": now - timedelta(days=days)}}

    async def distinct_message_count(extra_match: dict = None) -> int:
        match_stage = base_scope if not extra_match else {"$and": [base_scope, extra_match]}

        pipeline = [
            {"$match": match_stage},

            # ✅ fallback for OLD emails which don't have message_uid yet
            {"$addFields": {
                "_uid": {"$ifNull": ["$message_uid", {"$toString": "$_id"}]}
            }},

            {"$group": {"_id": "$_uid"}},
            {"$count": "count"}
        ]

        res = await email_collection.aggregate(pipeline).to_list(length=1)
        return res[0]["count"] if res else 0

    today_total = await distinct_message_count(time_filter(1))
    week_total = await distinct_message_count(time_filter(7))
    month_total = await distinct_message_count(time_filter(30))
    all_total = await distinct_message_count()

    total_contacts = await contact_collection.count_documents({"user_id": user_id})

    return {
        "distribution": {
            "inbox": inbox_count,
            "sent": sent_count,
            "trash": trash_count,
            "starred": starred_count,  # separate flag
        },
        "activity": {
            "today": today_total,
            "weekly": week_total,
            "monthly": month_total,
            "total": all_total,
        },
        "total_contacts": total_contacts,
        "date": now.isoformat()
    }

# GET current user
@app.get("/users/me")
async def get_current_user_profile(current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_helper(user)

# UPDATE user profile
@app.put("/users/me")
async def update_user_profile(update_data: dict, current_user: str = Depends(get_current_user)):
    user = await user_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    allowed_fields = ["name", "phone", "date_of_birth", "country", "city", "bio", 
                      "company", "position", "profile_picture_url"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_dict["updated_at"] = now_utc()
    await user_collection.update_one(
        {"_id": user["_id"]},
        {"$set": update_dict}
    )
    return {"message": "Profile updated"}
# Socket.IO Events for Real-time Notifications
@sio.event
async def connect(sid, environ):
    print(f"🔌 Client connected: {sid}")
@sio.event
async def disconnect(sid):
    print(f"🔌 Client disconnected: {sid}")
    # Update user offline status (note: assumes sid stored, but simplified)
    # For multi-tab, consider storing array of sids per user
    await user_collection.update_one(
        {"sid": sid},
        {"$set": {"is_online": False, "last_seen": now_utc()}}
    )
@sio.event
async def user_online(sid, data):
    """Mark user as online and store socket ID"""
    username = data.get("username")
    if username:
        await user_collection.update_one(
            {"username": username},
            {"$set": {"is_online": True, "sid": sid, "last_seen": now_utc()}}
        )
        await sio.emit("user_status", {"username": username, "is_online": True})
@sio.event
async def new_email_notification(sid, data):
    """Notify user about new email"""
    recipient_email = data.get("recipient_email")
    if recipient_email:
        user = await user_collection.find_one({"email": recipient_email})
        if user and user.get("sid"):
            await sio.emit("new_email", data, room=user["sid"])
# Startup/Shutdown
@app.on_event("startup")
async def startup_db_client():
    try:
        await client.admin.command('ping')
        print("✅ Connected to MongoDB!")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {str(e)}")
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
# Mount Socket.IO
app.mount("/socket.io", socket_app)