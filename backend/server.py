from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# HTTP Bearer for authentication
security = HTTPBearer()

# User Roles
class UserRole(str, Enum):
    ORGANIZER = "organizer"
    PARTICIPANT = "participant"
    JUDGE = "judge"

# Event Status
class EventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUBMISSIONS_OPEN = "submissions_open"
    SUBMISSIONS_CLOSED = "submissions_closed"
    JUDGING = "judging"
    COMPLETED = "completed"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    organizer_id: str
    status: EventStatus = EventStatus.DRAFT
    start_date: datetime
    end_date: datetime
    submission_deadline: datetime
    max_team_size: int = 4
    tracks: List[str] = []
    prizes: List[str] = []
    rules: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EventCreate(BaseModel):
    title: str
    description: str
    start_date: datetime
    end_date: datetime
    submission_deadline: datetime
    max_team_size: int = 4
    tracks: List[str] = []
    prizes: List[str] = []
    rules: str = ""

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    event_id: str
    leader_id: str
    members: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TeamCreate(BaseModel):
    name: str
    event_id: str

class Submission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team_id: str
    event_id: str
    title: str
    description: str
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    video_url: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)

class SubmissionCreate(BaseModel):
    title: str
    description: str
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    video_url: Optional[str] = None

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_data: dict) -> str:
    # Convert datetime objects to ISO strings for JSON serialization
    serializable_data = {}
    for key, value in user_data.items():
        if isinstance(value, datetime):
            serializable_data[key] = value.isoformat()
        else:
            serializable_data[key] = value
    
    payload = {
        **serializable_data,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = decode_jwt_token(credentials.credentials)
        user_id = payload.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = await db.users.find_one({"id": user_id})
        if not user_data:
            raise HTTPException(status_code=401, detail="User not found")
            
        return User(**user_data)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication")

def require_role(required_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# Authentication Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password and create user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role
    )
    
    # Store in database
    user_dict = user.dict()
    user_dict['password'] = hashed_password
    await db.users.insert_one(user_dict)
    
    return UserResponse(**user.dict())

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    # Find user
    user_data = await db.users.find_one({"email": login_data.email})
    if not user_data or not verify_password(login_data.password, user_data['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    user = User(**{k: v for k, v in user_data.items() if k != 'password'})
    token = create_jwt_token(user.dict())
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(**user.dict())
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.dict())

# Event Routes
@api_router.post("/events", response_model=Event)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(require_role([UserRole.ORGANIZER]))
):
    event = Event(
        **event_data.dict(),
        organizer_id=current_user.id
    )
    await db.events.insert_one(event.dict())
    return event

@api_router.get("/events", response_model=List[Event])
async def get_events():
    events = await db.events.find({"status": {"$ne": EventStatus.DRAFT}}).to_list(1000)
    return [Event(**event) for event in events]

@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str):
    event_data = await db.events.find_one({"id": event_id})
    if not event_data:
        raise HTTPException(status_code=404, detail="Event not found")
    return Event(**event_data)

@api_router.get("/events/my/organized", response_model=List[Event])
async def get_my_events(current_user: User = Depends(require_role([UserRole.ORGANIZER]))):
    events = await db.events.find({"organizer_id": current_user.id}).to_list(1000)
    return [Event(**event) for event in events]

@api_router.put("/events/{event_id}/status")
async def update_event_status(
    event_id: str,
    status: EventStatus,
    current_user: User = Depends(require_role([UserRole.ORGANIZER]))
):
    event = await db.events.find_one({"id": event_id, "organizer_id": current_user.id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found or unauthorized")
    
    await db.events.update_one({"id": event_id}, {"$set": {"status": status}})
    return {"message": "Event status updated successfully"}

# Team Routes
@api_router.post("/teams", response_model=Team)
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(require_role([UserRole.PARTICIPANT]))
):
    # Check if event exists and is active
    event = await db.events.find_one({"id": team_data.event_id})
    if not event or event['status'] not in [EventStatus.ACTIVE, EventStatus.SUBMISSIONS_OPEN]:
        raise HTTPException(status_code=400, detail="Event not available for registration")
    
    # Check if user already has a team for this event
    existing_team = await db.teams.find_one({
        "event_id": team_data.event_id,
        "$or": [
            {"leader_id": current_user.id},
            {"members": current_user.id}
        ]
    })
    if existing_team:
        raise HTTPException(status_code=400, detail="Already part of a team for this event")
    
    team = Team(
        **team_data.dict(),
        leader_id=current_user.id,
        members=[current_user.id]
    )
    await db.teams.insert_one(team.dict())
    return team

@api_router.get("/teams/my", response_model=List[Team])
async def get_my_teams(current_user: User = Depends(require_role([UserRole.PARTICIPANT]))):
    teams = await db.teams.find({
        "$or": [
            {"leader_id": current_user.id},
            {"members": current_user.id}
        ]
    }).to_list(1000)
    return [Team(**team) for team in teams]

# Submission Routes
@api_router.post("/submissions", response_model=Submission)
async def create_submission(
    submission_data: SubmissionCreate,
    team_id: str,
    current_user: User = Depends(require_role([UserRole.PARTICIPANT]))
):
    # Verify team membership
    team = await db.teams.find_one({"id": team_id})
    if not team or current_user.id not in team['members']:
        raise HTTPException(status_code=403, detail="Not a member of this team")
    
    # Check if event allows submissions
    event = await db.events.find_one({"id": team['event_id']})
    if not event or event['status'] not in [EventStatus.SUBMISSIONS_OPEN]:
        raise HTTPException(status_code=400, detail="Submissions not open for this event")
    
    # Check if submission already exists
    existing = await db.submissions.find_one({"team_id": team_id, "event_id": team['event_id']})
    if existing:
        raise HTTPException(status_code=400, detail="Submission already exists for this team")
    
    submission = Submission(
        **submission_data.dict(),
        team_id=team_id,
        event_id=team['event_id']
    )
    await db.submissions.insert_one(submission.dict())
    return submission

@api_router.get("/submissions/team/{team_id}", response_model=Optional[Submission])
async def get_team_submission(
    team_id: str,
    current_user: User = Depends(get_current_user)
):
    submission = await db.submissions.find_one({"team_id": team_id})
    if submission:
        return Submission(**submission)
    return None

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()