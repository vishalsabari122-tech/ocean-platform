from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from database import get_db
import auth_models
import auth
import datetime

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Schemas ───────────────────────────────────────────────

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    username: str

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TeamJoin(BaseModel):
    invite_code: str

# ── Register ──────────────────────────────────────────────

@router.post("/register")
def register(data: UserRegister, db: Session = Depends(get_db)):
    # Check if email exists
    if auth.get_user_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check username
    existing = db.query(auth_models.User).filter(auth_models.User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = auth_models.User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=auth.get_password_hash(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "username": user.username, "full_name": user.full_name}
    }

# ── Login ─────────────────────────────────────────────────

@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = auth.get_user_by_email(db, data.email)
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not auth.verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login = datetime.datetime.utcnow()
    db.commit()

    token = auth.create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "username": user.username, "full_name": user.full_name}
    }

# ── Google OAuth ──────────────────────────────────────────

@router.post("/google")
def google_auth(data: dict, db: Session = Depends(get_db)):
    """Receive Google user info from frontend after Google OAuth flow."""
    google_id = data.get("google_id")
    email = data.get("email")
    full_name = data.get("full_name", "")
    avatar_url = data.get("avatar_url", "")

    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Missing Google credentials")

    # Find or create user
    user = db.query(auth_models.User).filter(auth_models.User.google_id == google_id).first()
    if not user:
        user = auth.get_user_by_email(db, email)
        if user:
            # Link Google to existing account
            user.google_id = google_id
            user.avatar_url = avatar_url
        else:
            # Create new user
            username = email.split("@")[0]
            base_username = username
            counter = 1
            while db.query(auth_models.User).filter(auth_models.User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1

            user = auth_models.User(
                email=email,
                username=username,
                full_name=full_name,
                google_id=google_id,
                avatar_url=avatar_url,
            )
            db.add(user)

    user.last_login = datetime.datetime.utcnow()
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "username": user.username,
                 "full_name": user.full_name, "avatar_url": user.avatar_url}
    }

# ── Get current user ──────────────────────────────────────

@router.get("/me")
def get_me(current_user = Depends(auth.require_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "is_admin": current_user.is_admin,
        "created_at": str(current_user.created_at),
    }

# ── Teams ─────────────────────────────────────────────────

@router.post("/teams")
def create_team(data: TeamCreate, db: Session = Depends(get_db), current_user = Depends(auth.require_user)):
    team = auth_models.Team(
        name=data.name,
        description=data.description,
        owner_id=current_user.id,
        invite_code=auth.generate_invite_code(),
    )
    db.add(team)
    db.flush()

    # Add owner as admin member
    member = auth_models.TeamMember(team_id=team.id, user_id=current_user.id, role="admin")
    db.add(member)
    db.commit()
    db.refresh(team)

    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "invite_code": team.invite_code,
        "owner": current_user.username,
    }

@router.post("/teams/join")
def join_team(data: TeamJoin, db: Session = Depends(get_db), current_user = Depends(auth.require_user)):
    team = db.query(auth_models.Team).filter(auth_models.Team.invite_code == data.invite_code).first()
    if not team:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    # Check already member
    existing = db.query(auth_models.TeamMember).filter(
        auth_models.TeamMember.team_id == team.id,
        auth_models.TeamMember.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member of this team")

    member = auth_models.TeamMember(team_id=team.id, user_id=current_user.id, role="researcher")
    db.add(member)
    db.commit()

    return {"message": f"Joined team '{team.name}' successfully", "team_id": team.id}

@router.get("/teams/my")
def my_teams(db: Session = Depends(get_db), current_user = Depends(auth.require_user)):
    memberships = db.query(auth_models.TeamMember).filter(
        auth_models.TeamMember.user_id == current_user.id
    ).all()

    teams = []
    for m in memberships:
        team = m.team
        members_count = db.query(auth_models.TeamMember).filter(auth_models.TeamMember.team_id == team.id).count()
        teams.append({
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "role": m.role,
            "members_count": members_count,
            "invite_code": team.invite_code if m.role == "admin" else None,
            "owner": team.owner.username if team.owner else None,
        })
    return {"teams": teams}