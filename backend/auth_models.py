from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True, nullable=False)
    username      = Column(String, unique=True, index=True)
    full_name     = Column(String)
    hashed_password = Column(String, nullable=True)  # Null for Google OAuth users
    google_id     = Column(String, unique=True, nullable=True)
    avatar_url    = Column(String, nullable=True)
    is_active     = Column(Boolean, default=True)
    is_admin      = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)
    last_login    = Column(DateTime, nullable=True)

    # Relationships
    memberships   = relationship("TeamMember", back_populates="user")
    owned_teams   = relationship("Team", back_populates="owner")


class Team(Base):
    __tablename__ = "teams"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    invite_code = Column(String, unique=True, nullable=True)
    owner_id    = Column(Integer, ForeignKey("users.id"))
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)

    owner   = relationship("User", back_populates="owned_teams")
    members = relationship("TeamMember", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    id        = Column(Integer, primary_key=True, index=True)
    team_id   = Column(Integer, ForeignKey("teams.id"))
    user_id   = Column(Integer, ForeignKey("users.id"))
    role      = Column(String, default="researcher")  # researcher, admin
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="memberships")