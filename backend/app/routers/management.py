from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List

from ..database import get_db
from ..models import User, Department, Student
from ..schemas import UserCreate, UserUpdate, UserWithStats, DepartmentCreate, DepartmentUpdate, DepartmentWithCount
from ..routers.auth import get_current_user, require_admin, get_password_hash

router = APIRouter()


# =============================================================================
# USER MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/users", response_model=List[UserWithStats])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role: Optional[str] = Query(None, description="Filter by role: 'admin' or 'teacher'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all users with student counts (admin only)"""
    query = db.query(
        User.id,
        User.username,
        User.role,
        User.created_at,
        func.count(Student.id).label("student_count")
    ).outerjoin(
        Student, User.id == Student.created_by_user_id
    ).group_by(User.id)

    if role:
        query = query.filter(User.role == role)

    users = query.order_by(desc(User.created_at)).offset(skip).limit(limit).all()

    return [
        UserWithStats(
            id=user.id,
            username=user.username,
            role=user.role,
            created_at=user.created_at,
            student_count=user.student_count or 0
        )
        for user in users
    ]


@router.get("/users/{user_id}", response_model=UserWithStats)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get a single user by ID with student count (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    student_count = db.query(func.count(Student.id)).filter(
        Student.created_by_user_id == user_id
    ).scalar() or 0

    return UserWithStats(
        id=user.id,
        username=user.username,
        role=user.role,
        created_at=user.created_at,
        student_count=student_count
    )


@router.post("/users", response_model=UserWithStats, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new user (admin only)"""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Create new user (role is validated by Pydantic Literal type)
    new_user = User(
        username=user_data.username,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserWithStats(
        id=new_user.id,
        username=new_user.username,
        role=new_user.role,
        created_at=new_user.created_at,
        student_count=0
    )


@router.put("/users/{user_id}", response_model=UserWithStats)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from changing their own role (could lock themselves out)
    if user_id == current_user.id and user_data.role is not None and user_data.role != user.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )

    # Update username if provided
    if user_data.username is not None:
        # Check if new username already exists (and it's not this user)
        existing = db.query(User).filter(
            User.username == user_data.username,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        user.username = user_data.username

    # Update role if provided (validated by Pydantic Literal type)
    if user_data.role is not None:
        user.role = user_data.role

    # Update password if provided
    if user_data.password is not None:
        user.password_hash = get_password_hash(user_data.password)

    db.commit()
    db.refresh(user)

    student_count = db.query(func.count(Student.id)).filter(
        Student.created_by_user_id == user_id
    ).scalar() or 0

    return UserWithStats(
        id=user.id,
        username=user.username,
        role=user.role,
        created_at=user.created_at,
        student_count=student_count
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a user (admin only)"""
    # Prevent admin from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if user has students
    student_count = db.query(func.count(Student.id)).filter(
        Student.created_by_user_id == user_id
    ).scalar() or 0

    if student_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete user with {student_count} associated students. Reassign students first."
        )

    db.delete(user)
    db.commit()


# =============================================================================
# DEPARTMENT MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/departments", response_model=List[DepartmentWithCount])
async def get_departments(
    active_only: bool = Query(False, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all departments with student counts (admin only)"""
    query = db.query(
        Department.id,
        Department.name,
        Department.telegram_chat_id,
        Department.active,
        func.count(Student.id).label("student_count")
    ).outerjoin(
        Student, Department.id == Student.department_id
    ).group_by(Department.id)

    if active_only:
        query = query.filter(Department.active == True)

    departments = query.order_by(desc(Department.id)).all()

    return [
        DepartmentWithCount(
            id=dept.id,
            name=dept.name,
            telegram_chat_id=dept.telegram_chat_id,
            active=dept.active,
            student_count=dept.student_count or 0
        )
        for dept in departments
    ]


@router.get("/departments/{dept_id}", response_model=DepartmentWithCount)
async def get_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get a single department by ID with student count (admin only)"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )

    student_count = db.query(func.count(Student.id)).filter(
        Student.department_id == dept_id
    ).scalar() or 0

    return DepartmentWithCount(
        id=dept.id,
        name=dept.name,
        telegram_chat_id=dept.telegram_chat_id,
        active=dept.active,
        student_count=student_count
    )


@router.post("/departments", response_model=DepartmentWithCount, status_code=status.HTTP_201_CREATED)
async def create_department(
    dept_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new department (admin only)"""
    # Check if department name already exists
    existing_dept = db.query(Department).filter(Department.name == dept_data.name).first()
    if existing_dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department with this name already exists"
        )

    new_dept = Department(
        name=dept_data.name,
        telegram_chat_id=dept_data.telegram_chat_id,
        active=dept_data.active
    )

    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)

    return DepartmentWithCount(
        id=new_dept.id,
        name=new_dept.name,
        telegram_chat_id=new_dept.telegram_chat_id,
        active=new_dept.active,
        student_count=0
    )


@router.put("/departments/{dept_id}", response_model=DepartmentWithCount)
async def update_department(
    dept_id: int,
    dept_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a department (admin only)"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )

    # Update name if provided
    if dept_data.name is not None:
        # Check if new name already exists (and it's not this department)
        existing = db.query(Department).filter(
            Department.name == dept_data.name,
            Department.id != dept_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department with this name already exists"
            )
        dept.name = dept_data.name

    # Update telegram_chat_id if provided
    if dept_data.telegram_chat_id is not None:
        dept.telegram_chat_id = dept_data.telegram_chat_id

    # Update active status if provided
    if dept_data.active is not None:
        dept.active = dept_data.active

    db.commit()
    db.refresh(dept)

    student_count = db.query(func.count(Student.id)).filter(
        Student.department_id == dept_id
    ).scalar() or 0

    return DepartmentWithCount(
        id=dept.id,
        name=dept.name,
        telegram_chat_id=dept.telegram_chat_id,
        active=dept.active,
        student_count=student_count
    )


@router.delete("/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a department (admin only)"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )

    # Check if department has students
    student_count = db.query(func.count(Student.id)).filter(
        Student.department_id == dept_id
    ).scalar() or 0

    if student_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department with {student_count} associated students. Reassign students first."
        )

    db.delete(dept)
    db.commit()
