from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..database import get_db, turkey_now
from ..models import Student, Department, User
from ..schemas import StudentCreate, StudentUpdate, Student as StudentSchema, StudentList
from ..routers.auth import get_current_user, require_admin
from ..services.telegram import _send_notification_async
from ..services.sse import manager

router = APIRouter()


def require_student_access(student_id: int, current_user: User, db: Session) -> Student:
    """
    Helper function to check if user has access to a student.
    Admins can access any student, teachers can only access their own.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )

    # Teachers can only access students they created
    if current_user.role != "admin" and student.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this student"
        )

    return student


def broadcast_student_event(event_type: str, student_data: dict):
    """Broadcast SSE event when student is created/updated/deleted"""
    manager.broadcast({
        "type": event_type,
        "data": student_data,
        "timestamp": turkey_now().isoformat()
    })


@router.get("/check-duplicate")
async def check_duplicate(
    email: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if a student with the given email or phone already exists."""
    if not email and not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of email or phone must be provided"
        )

    query = db.query(
        Student.id,
        Student.first_name,
        Student.last_name,
        Student.email,
        Student.phone,
        Student.created_at,
        Department.name.label("department_name")
    ).outerjoin(Department)

    conditions = []
    if email:
        conditions.append(Student.email == email)
    if phone:
        conditions.append(Student.phone == phone)

    # Check for students matching email OR phone
    from sqlalchemy import or_
    query = query.filter(or_(*conditions))

    duplicates = query.order_by(Student.created_at.desc()).limit(5).all()

    return {
        "has_duplicates": len(duplicates) > 0,
        "count": len(duplicates),
        "duplicates": [
            {
                "id": d.id,
                "name": f"{d.first_name} {d.last_name}",
                "email": d.email,
                "phone": d.phone,
                "department": d.department_name,
                "created_at": d.created_at.isoformat()
            }
            for d in duplicates
        ]
    }


@router.get("")
async def get_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    department_id: Optional[int] = None,
    yks_type: Optional[str] = None,
    wants_tour: Optional[bool] = None,
    search: Optional[str] = None,
    teacher: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_by: Optional[str] = Query("created_at", description="Sort by column: created_at, ranking, first_name, last_name, yks_score, yks_type, wants_tour"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Build base query for counting
    count_query = db.query(Student.id).outerjoin(Department)

    # Build data query
    query = db.query(
        Student.id,
        Student.first_name,
        Student.last_name,
        Student.email,
        Student.phone,
        Student.high_school,
        Student.ranking,
        Student.yks_score,
        Student.yks_type,
        Student.wants_tour,
        Student.department_id,
        Department.name.label("department_name"),
        Student.created_at,
        Student.created_by_user_id,
        User.username.label("created_by_username")
    ).outerjoin(Department).outerjoin(User, Student.created_by_user_id == User.id)

    # Apply same filters to both queries
    if department_id:
        query = query.filter(Student.department_id == department_id)
        count_query = count_query.filter(Student.department_id == department_id)

    if yks_type:
        query = query.filter(Student.yks_type == yks_type)
        count_query = count_query.filter(Student.yks_type == yks_type)

    if wants_tour is not None:
        query = query.filter(Student.wants_tour == wants_tour)
        count_query = count_query.filter(Student.wants_tour == wants_tour)

    if teacher:
        # Only admins can filter by teacher
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can filter by teacher"
            )
        query = query.filter(User.username == teacher)
        count_query = count_query.join(User, Student.created_by_user_id == User.id).filter(User.username == teacher)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Student.first_name.ilike(search_pattern),
                Student.last_name.ilike(search_pattern),
                Student.email.ilike(search_pattern),
                Student.phone.ilike(search_pattern)
            )
        )
        count_query = count_query.filter(
            or_(
                Student.first_name.ilike(search_pattern),
                Student.last_name.ilike(search_pattern),
                Student.email.ilike(search_pattern),
                Student.phone.ilike(search_pattern)
            )
        )

    if start_date:
        query = query.filter(Student.created_at >= start_date)
        count_query = count_query.filter(Student.created_at >= start_date)

    if end_date:
        query = query.filter(Student.created_at <= end_date)
        count_query = count_query.filter(Student.created_at <= end_date)

    # Get total count
    total = count_query.count()

    # Dynamic sorting
    sort_columns = {
        'created_at': Student.created_at,
        'ranking': Student.ranking,
        'first_name': Student.first_name,
        'last_name': Student.last_name,
        'yks_score': Student.yks_score,
        'yks_type': Student.yks_type,
        'wants_tour': Student.wants_tour,
        'department_name': Department.name,
    }
    
    sort_column = sort_columns.get(sort_by, Student.created_at)
    if sort_order == 'asc':
        query = query.order_by(sort_column.asc().nulls_last())
    else:
        query = query.order_by(sort_column.desc().nulls_last())

    students = query.offset(skip).limit(limit).all()

    return {
        "data": [
            StudentList(
                id=s.id,
                first_name=s.first_name,
                last_name=s.last_name,
                email=s.email,
                phone=s.phone,
                high_school=s.high_school,
                ranking=s.ranking,
                yks_score=float(s.yks_score) if s.yks_score else None,
                yks_type=s.yks_type,
                wants_tour=s.wants_tour,
                department_id=s.department_id,
                department_name=s.department_name,
                created_at=s.created_at,
                created_by_user_id=s.created_by_user_id,
                created_by_username=s.created_by_username
            )
            for s in students
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }


# IMPORTANT: Specific routes must come BEFORE parameterized routes like /{student_id}
# Otherwise FastAPI will match /history or /departments/list as a student_id


@router.get("/departments/list", response_model=List[dict])
async def get_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    departments = db.query(Department).filter(Department.active == True).all()
    return [{"id": d.id, "name": d.name} for d in departments]


@router.get("/history/dates", response_model=List[dict])
async def get_history_dates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of dates with student counts (no student data).
    Used for lazy-loading history by date.
    """
    # Build query - filter by user for teachers
    # SQLite's func.date() returns string in YYYY-MM-DD format
    query = db.query(
        func.date(Student.created_at).label("date"),
        func.count(Student.id).label("count")
    )

    # Teachers see only their own students
    if current_user.role != 'admin':
        query = query.filter(Student.created_by_user_id == current_user.id)

    # Group by date, order by date descending
    results = query.group_by("date").order_by(desc("date")).all()

    # Format dates - SQLite returns string in YYYY-MM-DD format
    formatted_dates = []
    for row in results:
        # row.date is a string like "2026-01-20"
        date_parts = row.date.split('-')  # [YYYY, MM, DD]
        formatted_dates.append({
            "date": f"{date_parts[2]}.{date_parts[1]}.{date_parts[0]}",  # DD.MM.YYYY
            "date_iso": row.date,  # YYYY-MM-DD
            "count": row.count
        })

    return formatted_dates


@router.get("/history/by-date/{date_str}", response_model=List[StudentList])
async def get_history_by_date(
    date_str: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get students for a specific date.
    Date format: YYYY-MM-DD or DD.MM.YYYY
    """
    from datetime import datetime

    # Parse date - try both formats
    try:
        if '.' in date_str:
            target_date = datetime.strptime(date_str, '%d.%m.%Y').date()
        else:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use DD.MM.YYYY or YYYY-MM-DD")

    # Start and end of the target date
    start_datetime = datetime.combine(target_date, datetime.min.time())
    end_datetime = datetime.combine(target_date, datetime.max.time())

    # Build query
    query = db.query(
        Student.id,
        Student.first_name,
        Student.last_name,
        Student.email,
        Student.phone,
        Student.high_school,
        Student.ranking,
        Student.yks_score,
        Student.yks_type,
        Student.wants_tour,
        Student.department_id,
        Department.name.label("department_name"),
        Student.created_at,
        Student.created_by_user_id,
        User.username.label("created_by_username")
    ).outerjoin(Department).outerjoin(User, Student.created_by_user_id == User.id)

    # Teachers see only their own students
    if current_user.role != 'admin':
        query = query.filter(Student.created_by_user_id == current_user.id)

    # Filter by date range
    query = query.filter(
        Student.created_at >= start_datetime,
        Student.created_at <= end_datetime
    )

    # Order and paginate
    query = query.order_by(Student.created_at.desc())
    students = query.offset(skip).limit(limit).all()

    return [
        StudentList(
            id=s.id,
            first_name=s.first_name,
            last_name=s.last_name,
            email=s.email,
            phone=s.phone,
            high_school=s.high_school,
            ranking=s.ranking,
            yks_score=float(s.yks_score) if s.yks_score else None,
            yks_type=s.yks_type,
            wants_tour=s.wants_tour,
            department_id=s.department_id,
            department_name=s.department_name,
            created_at=s.created_at,
            created_by_user_id=s.created_by_user_id,
            created_by_username=s.created_by_username
        )
        for s in students
    ]


@router.get("/history", response_model=List[dict])
async def get_student_history(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get students grouped by date for history view.

    Admin sees all students, teachers only see their own registrations.
    """
    # Build query - filter by user for teachers
    query = db.query(
        Student.id,
        Student.first_name,
        Student.last_name,
        Student.email,
        Student.phone,
        Student.high_school,
        Student.ranking,
        Student.yks_score,
        Student.yks_type,
        Student.wants_tour,
        Student.department_id,
        Department.name.label("department_name"),
        Student.created_at
    ).outerjoin(Department)

    # Teachers see only their own students
    if current_user.role != 'admin':
        query = query.filter(Student.created_by_user_id == current_user.id)

    # Get students ordered by date descending
    students = query.order_by(Student.created_at.desc()).limit(limit).all()

    # Group by date
    history_dict = {}
    for student in students:
        # Format date as DD.MM.YYYY
        date_key = student.created_at.strftime('%d.%m.%Y')
        if date_key not in history_dict:
            history_dict[date_key] = []
        history_dict[date_key].append({
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "phone": student.phone,
            "high_school": student.high_school,
            "ranking": student.ranking,
            "yks_score": float(student.yks_score) if student.yks_score else None,
            "yks_type": student.yks_type,
            "wants_tour": student.wants_tour,
            "department_name": student.department_name,
            "created_at": student.created_at
        })

    # Convert to list of date groups
    history = [
        {
            "date": date,
            "count": len(students),
            "students": students
        }
        for date, students in history_dict.items()
    ]

    return history


@router.post("/mock-data", status_code=status.HTTP_201_CREATED)
async def create_mock_data(
    demo: bool = Query(False, description="Create demo data for university presentation"),
    load_test: bool = Query(False, description="Create 500 students in a single day (9AM-5PM) for load testing"),
    weekly: bool = Query(False, description="Create 70 students across 7 days for weekly testing"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create mock student data for testing and demonstration

    Modes:
    - Default: 20 students across 5 days (basic testing)
    - demo=true: 150 students across 30 days (comprehensive demo)
    - load_test=true: 500 students in one day (performance testing)
    - weekly=true: 70 students across 7 days (weekly testing)
    """
    from random import choice, randint, sample
    from ..models import Department

    # Get active departments
    departments = db.query(Department).filter(Department.active == True).all()
    if not departments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active departments found"
        )

    # Get teachers for realistic distribution
    from ..models import User
    teachers = db.query(User).filter(User.role == 'teacher').all()
    if not teachers:
        teachers = [current_user]

    # Demo data for university presentation - more comprehensive and realistic
    first_names = [
        "Ahmet", "Mehmet", "Ayşe", "Fatma", "Ali", "Zeynep", "Mustafa", "Elif",
        "Can", "Hakan", "Deniz", "Selin", "Emre", "Ece", "Burak", "Seda",
        "Kaan", "Merve", "Yusuf", "EDA", "Oğuz", "Simay", "Kerem", "Defne",
        "Arda", "Naz", "Berk", "Yağmur", "Umut", "İrem", "Mert", "Cemre"
    ]

    last_names = [
        "Yılmaz", "Demir", "Kaya", "Şahin", "Çelik", "Arslan", "Öztürk", "Aydın",
        "Yıldırım", "Koç", "Özkan", "Polat", "Kılıç", "Çetin", "Turan", "Akar",
        "Güneş", "Şahin", "Aslan", "Yavuz", "Erdoğan", "Korkmaz", "Durmaz"
    ]

    high_schools = [
        "İstanbul Lisesi", "Galatasaray Lisesi", "Robert Koleji", "Üsküdar Amerikan Lisesi",
        "Kabataş Erkek Lisesi", "Cağaloğlu Anadolu Lisesi", "Beşiktaş Atatürk Anadolu Lisesi",
        "Vefa Lisesi", "Saint Benoit Fransız Lisesi", "Saint Joseph Fransız Lisesi",
        "İstanbul Erkek Lisesi", "Kadıköy Anadolu Lisesi", "Anadolu Hisarı Lisesi"
    ]

    emails = [
        "ahmet.yilmaz@gmail.com", "mehmet.demir@hotmail.com", "ayse.kaya@yahoo.com",
        "fatma.sahin@gmail.com", "ali.celik@outlook.com", "zeynep.arslan@gmail.com",
        "mustafa.ozturk@hotmail.com", "elif.aydin@yahoo.com", "can.yildirim@gmail.com",
        "hakan.koc@outlook.com"
    ]

    # Department priorities for realistic distribution
    dept_priorities = {
        "Tıp": 0.25,      # 25% - Most popular
        "Diş Hekimliği": 0.15,  # 15%
        "Eczacılık": 0.12,       # 12%
        "Hukuk": 0.12,          # 12%
        "Mimarlık": 0.10,       # 10%
        "Mühendislik Fakültesi": 0.15,  # 15%
        "İşletme": 0.06,        # 6%
        "Psikoloji": 0.05       # 5%
    }

    # Weight departments by priority
    dept_weights = []
    for dept in departments:
        weight = dept_priorities.get(dept.name, 0.02)
        dept_weights.extend([dept] * int(weight * 100))

    created_students = []

    if load_test:
        # High-load test: 500 students in a single day (9 AM - 5 PM)
        total_students = 500
        today = turkey_now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Realistic hourly distribution for a busy university open day
        # Peak hours: 10-11 AM and 2-3 PM
        hourly_distribution = {
            9: 40,   # 9:00-10:00: Opening rush
            10: 75,  # 10:00-11:00: Peak morning
            11: 60,  # 11:00-12:00: Still busy
            12: 45,  # 12:00-13:00: Lunch dip
            13: 55,  # 13:00-14:00: Afternoon pickup
            14: 80,  # 14:00-15:00: Peak afternoon
            15: 70,  # 15:00-16:00: Late afternoon
            16: 50,  # 16:00-17:00: Closing time
            17: 25   # 17:00-18:00: Last arrivals
        }

        student_idx = 0
        for hour, count in hourly_distribution.items():
            for _ in range(count):
                if student_idx >= total_students:
                    break

                # Random minute and second within the hour
                minute = randint(0, 59)
                second = randint(0, 59)

                # Select department based on weights
                dept = choice(dept_weights) if dept_weights else choice(departments)

                # YKS type based on department
                dept_name = dept.name.lower()
                if "tıp" in dept_name or "eczacılık" in dept_name or "diş" in dept_name:
                    yks_type = "SAYISAL"
                    yks_score = randint(380, 480)
                elif "hukuk" in dept_name or "edebiyat" in dept_name:
                    yks_type = "SOZEL"
                    yks_score = randint(400, 500)
                elif "işletme" in dept_name or "ekonomi" in dept_name or "psikoloji" in dept_name:
                    yks_type = "EA"
                    yks_score = randint(350, 450)
                else:
                    yks_type = choice(["SAYISAL", "SOZEL", "EA", "DIL"])
                    yks_score = randint(320, 450)

                # Realistic ranking based on score
                if yks_score > 450:
                    ranking = randint(1000, 15000)
                elif yks_score > 400:
                    ranking = randint(15000, 50000)
                elif yks_score > 350:
                    ranking = randint(50000, 150000)
                else:
                    ranking = randint(150000, 400000)

                # Tour request probability (40% want tour on busy days)
                wants_tour = randint(1, 100) <= 40

                created_date = today.replace(hour=hour, minute=minute, second=second, microsecond=0)

                student = Student(
                    first_name=choice(first_names),
                    last_name=choice(last_names),
                    email=choice(emails) if randint(1, 10) > 3 else None,
                    phone=f"05{randint(31, 55)}{randint(100, 999)}{randint(10, 99)}{randint(10, 99)}" if randint(1, 10) > 2 else None,
                    high_school=choice(high_schools),
                    ranking=ranking,
                    yks_score=yks_score,
                    yks_type=yks_type,
                    department_id=dept.id,
                    wants_tour=wants_tour,
                    created_at=created_date,
                    created_by_user_id=choice(teachers).id
                )
                db.add(student)
                created_students.append(student)
                student_idx += 1

    elif demo:
        # Create comprehensive demo data spanning 14 days with realistic hourly distribution
        # At least 70 students per day
        days_span = 14
        students_per_day_min = 70
        students_per_day_max = 95

        total_students = days_span * students_per_day_min  # Minimum 980 students
        today = turkey_now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Realistic hourly distribution for each day
        # 8-10 AM: Less crowded (early arrivals)
        # 10-12 AM: Peak morning
        # 12-13 PM: Lunch dip
        # 13-16 PM: Peak afternoon
        # 16-17 PM: Moderate (late arrivals)
        hourly_distribution = {
            8: 5,     # 8:00-9:00: Early morning - few
            9: 8,     # 9:00-10:00: Still ramping up
            10: 12,   # 10:00-11:00: Peak morning start
            11: 14,   # 11:00-12:00: Peak morning
            12: 8,    # 12:00-13:00: Lunch dip
            13: 13,   # 13:00-14:00: Afternoon peak start
            14: 15,   # 14:00-15:00: Peak afternoon
            15: 12,   # 15:00-16:00: Still busy
            16: 8,    # 16:00-17:00: Late afternoon tapering
        }
        # Total per base day: ~95 students

        # Create students for each day
        student_idx = 0
        for days_ago in range(days_span - 1, -1, -1):
            date = today - timedelta(days=days_ago)
            day_of_week = date.weekday()

            # Adjust for weekends (slightly fewer on Saturday/Sunday)
            weekend_factor = 0.7 if day_of_week >= 5 else 1.0

            for hour, base_count in hourly_distribution.items():
                # Apply weekend factor and add some randomness
                actual_count = int(base_count * weekend_factor) + randint(-2, 2)
                actual_count = max(2, actual_count)  # At least 2 per hour

                for _ in range(actual_count):
                    # Random minute and second within the hour
                    minute = randint(0, 59)
                    second = randint(0, 59)

                    # Select department based on weights
                    dept = choice(dept_weights) if dept_weights else choice(departments)

                    # YKS type based on department
                    dept_name = dept.name.lower()
                    if "tıp" in dept_name or "eczacılık" in dept_name or "diş" in dept_name:
                        yks_type = "SAYISAL"
                        yks_score = randint(380, 480)
                    elif "hukuk" in dept_name or "edebiyat" in dept_name:
                        yks_type = "SOZEL"
                        yks_score = randint(400, 500)
                    elif "işletme" in dept_name or "ekonomi" in dept_name or "psikoloji" in dept_name:
                        yks_type = "EA"
                        yks_score = randint(350, 450)
                    else:
                        yks_type = choice(["SAYISAL", "SOZEL", "EA", "DIL"])
                        yks_score = randint(320, 450)

                    # Realistic ranking based on score
                    if yks_score > 450:
                        ranking = randint(1000, 15000)
                    elif yks_score > 400:
                        ranking = randint(15000, 50000)
                    elif yks_score > 350:
                        ranking = randint(50000, 150000)
                    else:
                        ranking = randint(150000, 400000)

                    # Tour request probability (35% want tour)
                    wants_tour = randint(1, 100) <= 35

                    created_date = date.replace(hour=hour, minute=minute, second=second, microsecond=0)

                    student = Student(
                        first_name=choice(first_names),
                        last_name=choice(last_names),
                        email=choice(emails) if randint(1, 10) > 2 else None,
                        phone=f"05{randint(31, 55)}{randint(100, 999)}{randint(10, 99)}{randint(10, 99)}" if randint(1, 10) > 2 else None,
                        high_school=choice(high_schools),
                        ranking=ranking,
                        yks_score=yks_score,
                        yks_type=yks_type,
                        department_id=dept.id,
                        wants_tour=wants_tour,
                        created_at=created_date,
                        created_by_user_id=choice(teachers).id
                    )
                    db.add(student)
                    created_students.append(student)
                    student_idx += 1

    elif weekly:
        # Weekly test data - 70 students across 7 days for weekly testing
        total_students = 70
        today = turkey_now().replace(hour=12, minute=0, second=0, microsecond=0)

        # Define daily targets with realistic weekly patterns
        # Weekdays: higher, Weekend: lower
        daily_targets = []
        for days_ago in range(6, -1, -1):
            date = today - timedelta(days=days_ago)
            day_of_week = date.weekday()

            # Weekday vs weekend pattern
            if day_of_week >= 5:  # Weekend (Saturday=5, Sunday=6)
                base_count = randint(4, 8)
            else:  # Weekday (Monday=0 to Friday=4)
                base_count = randint(10, 15)

            # Add some randomness
            daily_targets.append(max(3, base_count + randint(-2, 2)))

        # Create students distributed across the week
        student_idx = 0
        for days_ago in range(6, -1, -1):
            daily_count = daily_targets[6 - days_ago]
            for _ in range(daily_count):
                if student_idx >= total_students:
                    break

                date = today - timedelta(days=days_ago)
                hour = randint(9, 17)  # 9 AM to 5 PM
                minute = randint(0, 59)

                # Select department based on weights
                dept = choice(dept_weights) if dept_weights else choice(departments)

                # YKS type based on department
                dept_name = dept.name.lower()
                if "tıp" in dept_name or "eczacılık" in dept_name or "diş" in dept_name:
                    yks_type = "SAYISAL"
                    yks_score = randint(380, 480)
                elif "hukuk" in dept_name or "edebiyat" in dept_name:
                    yks_type = "SOZEL"
                    yks_score = randint(400, 500)
                elif "işletme" in dept_name or "ekonomi" in dept_name or "psikoloji" in dept_name:
                    yks_type = "EA"
                    yks_score = randint(350, 450)
                else:
                    yks_type = choice(["SAYISAL", "SOZEL", "EA", "DIL"])
                    yks_score = randint(320, 450)

                # Realistic ranking based on score
                if yks_score > 450:
                    ranking = randint(1000, 15000)
                elif yks_score > 400:
                    ranking = randint(15000, 50000)
                elif yks_score > 350:
                    ranking = randint(50000, 150000)
                else:
                    ranking = randint(150000, 400000)

                # Tour request probability (30% want tour)
                wants_tour = randint(1, 100) <= 30

                created_date = date.replace(hour=hour, minute=minute, second=0, microsecond=0)

                student = Student(
                    first_name=choice(first_names),
                    last_name=choice(last_names),
                    email=choice(emails) if randint(1, 10) > 2 else None,
                    phone=f"05{randint(31, 55)}{randint(100, 999)}{randint(10, 99)}{randint(10, 99)}" if randint(1, 10) > 2 else None,
                    high_school=choice(high_schools),
                    ranking=ranking,
                    yks_score=yks_score,
                    yks_type=yks_type,
                    department_id=dept.id,
                    wants_tour=wants_tour,
                    created_at=created_date,
                    created_by_user_id=choice(teachers).id
                )
                db.add(student)
                created_students.append(student)
                student_idx += 1

    else:
        # Simple test data - 20 students across 5 days
        count = 20
        yks_types = ["SAYISAL", "SOZEL", "EA", "DIL"]

        for i in range(count):
            days_ago = (i % 5)
            created_date = turkey_now() - timedelta(days=days_ago, hours=randint(8, 17), minutes=randint(0, 59))

            student = Student(
                first_name=choice(first_names),
                last_name=choice(last_names),
                email=choice(emails) if randint(0, 3) > 0 else None,
                phone=f"+9{randint(100, 999)}{randint(100000, 999999)}" if randint(0, 2) > 0 else None,
                high_school=choice(high_schools),
                ranking=randint(100, 500000) if randint(0, 1) > 0 else None,
                yks_score=randint(180, 450) if randint(0, 1) > 0 else None,
                yks_type=choice(yks_types),
                department_id=choice(departments).id,
                wants_tour=randint(0, 3) == 1,
                created_at=created_date,
                created_by_user_id=choice(teachers).id
            )
            db.add(student)
            created_students.append(student)

    db.commit()

    # Broadcast events for each created student
    for student in created_students:
        broadcast_student_event("student_created", {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "department_id": student.department_id,
            "wants_tour": student.wants_tour
        })

    return {
        "message": f"Created {len(created_students)} mock students",
        "details": {
            "total_students": len(created_students),
            "span_days": 1 if load_test else (30 if demo else (7 if weekly else 5)),
            "departments": len(departments),
            "teachers": len(teachers),
            "mode": "load_test" if load_test else ("demo" if demo else ("weekly" if weekly else "simple"))
        }
    }


@router.delete("/mock-data", status_code=status.HTTP_200_OK)
async def delete_mock_data(
    confirm: bool = Query(False, description="Must be true to confirm deletion"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete ALL student data (admin only)"""
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set confirm=true to confirm deletion"
        )

    # Delete ALL students
    deleted_count = db.query(Student).delete(synchronize_session=False)
    db.commit()

    return {"message": f"Tüm veriler silindi ({deleted_count} öğrenci)"}


@router.get("/{student_id}", response_model=StudentSchema)
async def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check access using helper
    student = require_student_access(student_id, current_user, db)
    return StudentSchema.from_orm(student)


@router.post("", response_model=StudentSchema, status_code=status.HTTP_201_CREATED)
async def create_student(
    student_data: StudentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify department exists if provided
    if student_data.department_id:
        department = db.query(Department).filter(
            Department.id == student_data.department_id
        ).first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department not found"
            )

    # Create student
    new_student = Student(
        **student_data.model_dump(exclude_unset=True),
        created_by_user_id=current_user.id
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    # Load department for response
    db.refresh(new_student)

    # Send tour notification if requested (background task)
    if new_student.wants_tour and new_student.department_id:
        from ..services.telegram import send_tour_notification
        notification_data = send_tour_notification(new_student, db)
        if notification_data:
            # Add background task to send notification
            background_tasks.add_task(notification_data)

    # Broadcast SSE event
    broadcast_student_event("student_created", {
        "id": new_student.id,
        "first_name": new_student.first_name,
        "last_name": new_student.last_name,
        "department_id": new_student.department_id,
        "wants_tour": new_student.wants_tour
    })

    return StudentSchema.from_orm(new_student)


@router.put("/{student_id}", response_model=StudentSchema)
async def update_student(
    student_id: int,
    student_data: StudentUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check access using helper
    student = require_student_access(student_id, current_user, db)

    # Verify department exists if provided
    if student_data.department_id:
        department = db.query(Department).filter(
            Department.id == student_data.department_id
        ).first()
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department not found"
            )

    # Update fields
    update_data = student_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)

    # Send tour notification if newly requested and not yet sent (background task)
    if student.wants_tour and not student.tour_sent and student.department_id:
        from ..services.telegram import send_tour_notification
        notification_data = send_tour_notification(student, db)
        if notification_data:
            # Add background task to send notification
            background_tasks.add_task(notification_data)
            student.tour_sent = True
            db.commit()

    # Broadcast SSE event
    broadcast_student_event("student_updated", {
        "id": student.id,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "department_id": student.department_id,
        "wants_tour": student.wants_tour
    })

    return StudentSchema.from_orm(student)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )

    student_data = {
        "id": student.id,
        "first_name": student.first_name,
        "last_name": student.last_name
    }

    db.delete(student)
    db.commit()

    # Broadcast SSE event
    broadcast_student_event("student_deleted", student_data)

    return None

