from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.types import DECIMAL
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import turkey_now, Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="teacher")  # 'teacher' or 'admin'
    created_at = Column(DateTime, default=turkey_now)

    # Relationships
    students = relationship("Student", back_populates="created_by_user")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    telegram_chat_id = Column(String(100), nullable=True)  # Telegram group chat ID
    active = Column(Boolean, default=True)

    # Relationships
    students = relationship("Student", back_populates="department")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    high_school = Column(String(255), nullable=True)
    ranking = Column(Integer, nullable=True)
    yks_score = Column(DECIMAL(5, 2), nullable=True)
    yks_type = Column(String(20), nullable=True)  # 'SAYISAL', 'SOZEL', 'EA', 'DIL'
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    wants_tour = Column(Boolean, default=False)
    tour_sent = Column(Boolean, default=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=turkey_now)
    updated_at = Column(DateTime, default=turkey_now, onupdate=turkey_now)

    # Relationships
    created_by_user = relationship("User", back_populates="students")
    department = relationship("Department", back_populates="students")
