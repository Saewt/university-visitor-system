from pydantic import BaseModel, EmailStr, Field, validator
from typing import Literal
from datetime import datetime
from typing import Optional, List, Union
from decimal import Decimal


# User Schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    role: Literal["teacher", "admin"] = "teacher"


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    role: Optional[Literal["teacher", "admin"]] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)  # Only update password if provided


class UserWithStats(User):
    student_count: int = 0


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


# Department Schemas
class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    telegram_chat_id: Optional[str] = Field(None, max_length=100)
    active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    id: int

    class Config:
        from_attributes = True


class DepartmentWithCount(Department):
    student_count: int = 0


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    active: Optional[bool] = None


# Student Schemas
class StudentBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = Field("", max_length=255)  # Changed from EmailStr to str
    phone: Optional[str] = Field(None, max_length=20)
    high_school: Optional[str] = Field(None, max_length=255)
    ranking: Optional[int] = Field(None, ge=1)
    yks_score: Optional[Decimal] = Field(None, ge=0, le=600)
    yks_type: Optional[str] = None
    department_id: Optional[int] = None
    wants_tour: bool = False

    @validator("email")
    def validate_email(cls, v):
        # Allow None or empty string, but validate email format if provided
        if v is None or v == "":
            return v
        if "@" not in v:
            raise ValueError("Invalid email format")
        return v

    @validator("yks_type")
    def validate_yks_type(cls, v):
        if v is not None and v != "" and v not in ["SAYISAL", "SOZEL", "EA", "DIL"]:
            raise ValueError("YKS type must be one of: SAYISAL, SOZEL, EA, DIL")
        return v or None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = Field("", max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    high_school: Optional[str] = Field(None, max_length=255)
    ranking: Optional[int] = Field(None, ge=1)
    yks_score: Optional[Decimal] = Field(None, ge=0, le=600)
    yks_type: Optional[str] = None
    department_id: Optional[int] = None
    wants_tour: Optional[bool] = None

    @validator("email")
    def validate_email(cls, v):
        if v is not None and v != "" and "@" not in v:
            raise ValueError("Invalid email format")
        return v or ""

    @validator("yks_type")
    def validate_yks_type(cls, v):
        if v is not None and v != "" and v not in ["SAYISAL", "SOZEL", "EA", "DIL"]:
            raise ValueError("YKS type must be one of: SAYISAL, SOZEL, EA, DIL")
        return v or None


class Student(StudentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by_user_id: Optional[int] = None
    tour_sent: bool = False
    department: Optional[Department] = None

    class Config:
        from_attributes = True


class StudentList(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    high_school: Optional[str] = None
    ranking: Optional[int] = None
    yks_score: Optional[Decimal] = None
    yks_type: Optional[str] = None
    wants_tour: bool
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    created_at: datetime
    created_by_user_id: Optional[int] = None
    created_by_username: Optional[str] = None

    class Config:
        from_attributes = True


# Stats Schemas
class StatsSummary(BaseModel):
    total_students: int
    unique_students: int
    today_count: int
    tour_requests: int
    unique_departments: int


class DataQualityStats(BaseModel):
    incomplete_records: int  # Records missing email, phone, or department
    duplicate_emails: int
    duplicate_phones: int
    quality_score: float  # Percentage of complete records


class DepartmentStats(BaseModel):
    department_name: str
    count: int


class YksTypeStats(BaseModel):
    yks_type: str
    count: int


class TourRequestStats(BaseModel):
    department_name: str
    tour_requests: int
    total_students: int


class HourlyStats(BaseModel):
    hour: int
    count: int


class TeacherStats(BaseModel):
    user_id: int
    username: str
    count: int
    today_count: int


class DuplicateRecord(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime
    duplicate_type: str  # 'email' or 'phone'
    match_count: int  # How many times this identifier appears


class ConversionFunnel(BaseModel):
    registered: int
    tour_requested: int
    tour_sent: int
    tour_request_rate: float  # %
    tour_completion_rate: float  # %


class StatsResponse(BaseModel):
    summary: StatsSummary
    data_quality: DataQualityStats
    by_department: List[DepartmentStats]
    by_type: List[YksTypeStats]
    tour_requests: List[TourRequestStats]
    hourly: List[HourlyStats]
    by_teacher: List[TeacherStats]
    conversion_funnel: Optional[ConversionFunnel] = None


# SSE Event Schema
class SSEEvent(BaseModel):
    type: str  # 'student_created', 'student_updated', 'student_deleted'
    data: dict


# Export Schema
class ExportParams(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    department_id: Optional[int] = None
