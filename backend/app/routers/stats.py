from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Optional, List

from ..database import get_db, turkey_now, TURKEY_TZ
from ..models import Student, Department, User
from ..schemas import (
    StatsSummary,
    StatsResponse,
    DataQualityStats,
    DepartmentStats,
    YksTypeStats,
    TourRequestStats,
    HourlyStats,
    TeacherStats,
    DuplicateRecord,
    ConversionFunnel
)
from ..routers.auth import get_current_user

router = APIRouter()


def _get_data_quality_stats(db: Session) -> DataQualityStats:
    """Calculate data quality metrics"""
    total = db.query(func.count(Student.id)).scalar() or 0

    # Incomplete records: missing email, phone, or department
    incomplete = db.query(func.count(Student.id)).filter(
        (Student.email == None) | (Student.email == '') |
        (Student.phone == None) |
        (Student.department_id == None)
    ).scalar() or 0

    # Duplicate emails
    duplicate_emails = 0
    email_counts = db.query(
        Student.email,
        func.count(Student.id).label('count')
    ).filter(
        Student.email.isnot(None),
        Student.email != ''
    ).group_by(Student.email).all()

    duplicate_emails = sum(1 for email, count in email_counts if count > 1)

    # Duplicate phones
    duplicate_phones = 0
    phone_counts = db.query(
        Student.phone,
        func.count(Student.id).label('count')
    ).filter(
        Student.phone.isnot(None),
        Student.phone != ''
    ).group_by(Student.phone).all()

    duplicate_phones = sum(1 for phone, count in phone_counts if count > 1)

    # Quality score: percentage of complete records
    quality_score = round((total - incomplete) / total * 100, 1) if total > 0 else 100.0

    return DataQualityStats(
        incomplete_records=incomplete,
        duplicate_emails=duplicate_emails,
        duplicate_phones=duplicate_phones,
        quality_score=quality_score
    )


@router.get("/quality", response_model=DataQualityStats)
async def get_quality_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get data quality metrics"""
    return _get_data_quality_stats(db)


@router.get("/duplicates", response_model=List[DuplicateRecord])
async def get_duplicates(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get actual duplicate student records for review/merge

    Returns students that share the same email or phone with others.
    Only admins see all duplicates; teachers see none.
    """
    # Only admins can view duplicates
    if current_user.role != 'admin':
        return []

    duplicates = []

    # Find duplicate emails
    email_duplicates = db.query(
        Student.email,
        func.count(Student.id).label('count')
    ).filter(
        Student.email.isnot(None),
        Student.email != ''
    ).group_by(
        Student.email
    ).having(
        func.count(Student.id) > 1
    ).all()

    for email, count in email_duplicates:
        matching_students = db.query(Student).outerjoin(Department).filter(
            Student.email == email
        ).order_by(Student.created_at.desc()).all()

        for i, s in enumerate(matching_students):
            duplicates.append(DuplicateRecord(
                id=s.id,
                first_name=s.first_name,
                last_name=s.last_name,
                email=s.email,
                phone=s.phone,
                department_name=s.department.name if s.department else None,
                created_at=s.created_at,
                duplicate_type='email',
                match_count=count
            ))

    # Find duplicate phones (excluding those already matched by email)
    phone_duplicate_emails = set(d.email for d in duplicates if d.email)

    phone_duplicates = db.query(
        Student.phone,
        func.count(Student.id).label('count')
    ).filter(
        Student.phone.isnot(None),
        Student.phone != ''
    ).group_by(
        Student.phone
    ).having(
        func.count(Student.id) > 1
    ).all()

    for phone, count in phone_duplicates:
        matching_students = db.query(Student).outerjoin(Department).filter(
            Student.phone == phone
        )
        # Exclude those already in email duplicates
        if phone_duplicate_emails:
            matching_students = matching_students.filter(
                ~Student.email.in_(phone_duplicate_emails)
            )
        matching_students = matching_students.order_by(Student.created_at.desc()).all()

        for s in matching_students:
            duplicates.append(DuplicateRecord(
                id=s.id,
                first_name=s.first_name,
                last_name=s.last_name,
                email=s.email,
                phone=s.phone,
                department_name=s.department.name if s.department else None,
                created_at=s.created_at,
                duplicate_type='phone',
                match_count=count
            ))

    # Sort by match count (desc), then created_at (desc), and limit
    duplicates.sort(key=lambda d: (-d.match_count, -d.created_at.timestamp()))
    return duplicates[:limit]


@router.get("/funnel", response_model=ConversionFunnel)
async def get_conversion_funnel(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get conversion funnel metrics: Registered → Tour Requested → Tour Sent"""
    registered = db.query(func.count(Student.id)).scalar() or 0
    tour_requested = db.query(func.count(Student.id)).filter(
        Student.wants_tour == True
    ).scalar() or 0
    tour_sent = db.query(func.count(Student.id)).filter(
        Student.tour_sent == True
    ).scalar() or 0

    tour_request_rate = round((tour_requested / registered * 100), 1) if registered > 0 else 0.0
    tour_completion_rate = round((tour_sent / tour_requested * 100), 1) if tour_requested > 0 else 0.0

    return ConversionFunnel(
        registered=registered,
        tour_requested=tour_requested,
        tour_sent=tour_sent,
        tour_request_rate=tour_request_rate,
        tour_completion_rate=tour_completion_rate
    )


@router.get("/summary", response_model=StatsSummary)
async def get_summary(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    today_start = turkey_now().replace(hour=0, minute=0, second=0, microsecond=0)

    total_students = db.query(func.count(Student.id)).scalar() or 0

    # Unique students: count distinct by email or phone (prioritize email, fall back to phone)
    # This counts students who have at least one identifier
    unique_students = 0
    if total_students > 0:
        # Count students with unique email
        unique_emails = db.query(func.count(func.distinct(Student.email))).filter(
            Student.email.isnot(None),
            Student.email != ''
        ).scalar() or 0

        # Count students with unique phone (who don't have email)
        unique_phones_only = db.query(func.count(func.distinct(Student.phone))).filter(
            Student.phone.isnot(None),
            Student.phone != '',
            (Student.email == None) | (Student.email == '')
        ).scalar() or 0

        # Count students with no email or phone (use first_name + last_name combo)
        no_identifier = db.query(func.count(Student.id)).filter(
            (Student.email == None) | (Student.email == ''),
            (Student.phone == None) | (Student.phone == '')
        ).scalar() or 0

        unique_students = unique_emails + unique_phones_only + no_identifier

    today_count = db.query(func.count(Student.id)).filter(
        Student.created_at >= today_start
    ).scalar() or 0
    tour_requests = db.query(func.count(Student.id)).filter(
        Student.wants_tour == True
    ).scalar() or 0
    unique_departments = db.query(func.count(func.distinct(Student.department_id))).scalar() or 0

    return StatsSummary(
        total_students=total_students,
        unique_students=unique_students,
        today_count=today_count,
        tour_requests=tour_requests,
        unique_departments=unique_departments
    )


@router.get("/by-department", response_model=List[DepartmentStats])
async def get_stats_by_department(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    results = db.query(
        Department.name,
        func.count(Student.id).label("count")
    ).outerjoin(
        Student, Department.id == Student.department_id
    ).group_by(
        Department.id, Department.name
    ).order_by(
        desc("count")
    ).limit(limit).all()

    return [
        DepartmentStats(department_name=row.name or "Belirtilmemiş", count=row.count or 0)
        for row in results
    ]


@router.get("/by-type", response_model=List[YksTypeStats])
async def get_stats_by_type(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    results = db.query(
        Student.yks_type,
        func.count(Student.id).label("count")
    ).filter(
        Student.yks_type.isnot(None)
    ).group_by(Student.yks_type).all()

    return [
        YksTypeStats(yks_type=row.yks_type, count=row.count)
        for row in results
    ]


@router.get("/tour-requests", response_model=List[TourRequestStats])
async def get_tour_requests_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    results = db.query(
        Department.name.label("department_name"),
        func.count(Student.id).label("tour_requests")
    ).outerjoin(
        Student, Department.id == Student.department_id
    ).filter(
        Student.wants_tour == True
    ).group_by(Department.id, Department.name).all()

    # Get total students per department for comparison
    department_stats = {}
    for row in results:
        total = db.query(func.count(Student.id)).filter(
            Student.department_id == Department.id,
            Department.name == row.department_name
        ).scalar() or 0
        department_stats[row.department_name] = TourRequestStats(
            department_name=row.department_name,
            tour_requests=row.tour_requests,
            total_students=total
        )

    return list(department_stats.values())


@router.get("/hourly", response_model=List[HourlyStats])
async def get_hourly_stats(
    days: int = Query(1, ge=1, le=7),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    start_date = turkey_now() - timedelta(days=days)

    results = db.query(
        func.extract("hour", Student.created_at).label("hour"),
        func.count(Student.id).label("count")
    ).filter(
        Student.created_at >= start_date
    ).group_by("hour").order_by("hour").all()

    return [
        HourlyStats(hour=int(row.hour), count=row.count)
        for row in results
    ]


@router.get("/by-teacher", response_model=List[TeacherStats])
async def get_stats_by_teacher(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get statistics of student registrations by teacher/creator"""
    today_start = turkey_now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Get all users who have created students
    results = db.query(
        User.id.label("user_id"),
        User.username,
        func.count(Student.id).label("count")
    ).outerjoin(
        Student, User.id == Student.created_by_user_id
    ).filter(
        User.role.in_(["teacher", "admin"])
    ).group_by(
        User.id, User.username
    ).order_by(
        desc("count")
    ).all()

    teacher_stats = []
    for row in results:
        # Get today's count for this teacher
        today_count = db.query(func.count(Student.id)).filter(
            Student.created_by_user_id == row.user_id,
            Student.created_at >= today_start
        ).scalar() or 0

        teacher_stats.append(TeacherStats(
            user_id=row.user_id,
            username=row.username,
            count=row.count or 0,
            today_count=today_count
        ))

    return teacher_stats


@router.get("", response_model=StatsResponse)
async def get_all_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Summary
    today_start = turkey_now().replace(hour=0, minute=0, second=0, microsecond=0)
    total_students = db.query(func.count(Student.id)).scalar() or 0

    # Calculate unique students
    unique_students = 0
    if total_students > 0:
        unique_emails = db.query(func.count(func.distinct(Student.email))).filter(
            Student.email.isnot(None),
            Student.email != ''
        ).scalar() or 0
        unique_phones_only = db.query(func.count(func.distinct(Student.phone))).filter(
            Student.phone.isnot(None),
            Student.phone != '',
            (Student.email == None) | (Student.email == '')
        ).scalar() or 0
        no_identifier = db.query(func.count(Student.id)).filter(
            (Student.email == None) | (Student.email == ''),
            (Student.phone == None) | (Student.phone == '')
        ).scalar() or 0
        unique_students = unique_emails + unique_phones_only + no_identifier

    summary = StatsSummary(
        total_students=total_students,
        unique_students=unique_students,
        today_count=db.query(func.count(Student.id)).filter(
            Student.created_at >= today_start
        ).scalar() or 0,
        tour_requests=db.query(func.count(Student.id)).filter(
            Student.wants_tour == True
        ).scalar() or 0,
        unique_departments=db.query(func.count(func.distinct(Student.department_id))).scalar() or 0
    )

    # Data quality
    data_quality = _get_data_quality_stats(db)

    # By department
    dept_results = db.query(
        Department.name,
        func.count(Student.id).label("count")
    ).outerjoin(Student, Department.id == Student.department_id).group_by(
        Department.id, Department.name
    ).order_by(desc("count")).limit(10).all()
    by_department = [
        DepartmentStats(department_name=row.name or "Belirtilmemiş", count=row.count or 0)
        for row in dept_results
    ]

    # By type
    type_results = db.query(
        Student.yks_type,
        func.count(Student.id).label("count")
    ).filter(Student.yks_type.isnot(None)).group_by(Student.yks_type).all()
    by_type = [
        YksTypeStats(yks_type=row.yks_type, count=row.count)
        for row in type_results
    ]

    # Tour requests
    tour_results = db.query(
        Department.name.label("department_name"),
        func.count(Student.id).label("tour_requests")
    ).outerjoin(Student, Department.id == Student.department_id).filter(
        Student.wants_tour == True
    ).group_by(Department.id, Department.name).all()
    tour_requests = []
    for row in tour_results:
        total = db.query(func.count(Student.id)).filter(
            Student.department_id == Department.id
        ).scalar() or 0
        tour_requests.append(TourRequestStats(
            department_name=row.department_name,
            tour_requests=row.tour_requests,
            total_students=total
        ))

    # Hourly (today)
    today_start = turkey_now().replace(hour=0, minute=0, second=0, microsecond=0)
    hourly_results = db.query(
        func.extract("hour", Student.created_at).label("hour"),
        func.count(Student.id).label("count")
    ).filter(Student.created_at >= today_start).group_by("hour").order_by("hour").all()
    hourly = [
        HourlyStats(hour=int(row.hour), count=row.count)
        for row in hourly_results
    ]

    # By teacher
    teacher_results = db.query(
        User.id.label("user_id"),
        User.username,
        func.count(Student.id).label("count")
    ).outerjoin(
        Student, User.id == Student.created_by_user_id
    ).filter(
        User.role.in_(["teacher", "admin"])
    ).group_by(
        User.id, User.username
    ).order_by(
        desc("count")
    ).all()
    by_teacher = []
    for row in teacher_results:
        today_count = db.query(func.count(Student.id)).filter(
            Student.created_by_user_id == row.user_id,
            Student.created_at >= today_start
        ).scalar() or 0
        by_teacher.append(TeacherStats(
            user_id=row.user_id,
            username=row.username,
            count=row.count or 0,
            today_count=today_count
        ))

    # Conversion funnel
    registered = summary.total_students
    tour_requested = summary.tour_requests
    tour_sent = db.query(func.count(Student.id)).filter(
        Student.tour_sent == True
    ).scalar() or 0

    tour_request_rate = round((tour_requested / registered * 100), 1) if registered > 0 else 0.0
    tour_completion_rate = round((tour_sent / tour_requested * 100), 1) if tour_requested > 0 else 0.0

    conversion_funnel = ConversionFunnel(
        registered=registered,
        tour_requested=tour_requested,
        tour_sent=tour_sent,
        tour_request_rate=tour_request_rate,
        tour_completion_rate=tour_completion_rate
    )

    return StatsResponse(
        summary=summary,
        data_quality=data_quality,
        by_department=by_department,
        by_type=by_type,
        tour_requests=tour_requests,
        hourly=hourly,
        by_teacher=by_teacher,
        conversion_funnel=conversion_funnel
    )


@router.get("/comparison")
async def get_comparison_stats(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    compare_with: str = Query("yesterday", description="Period to compare: yesterday, last_week, last_month"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Compare current period with previous period"""
    today = turkey_now()
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)

    # Determine current period
    current_start, current_end = _parse_date_range(start_date, end_date, today)

    # Determine comparison period
    if compare_with == "yesterday":
        compare_start = current_start - timedelta(days=1)
        compare_end = current_end - timedelta(days=1)
    elif compare_with == "last_week":
        compare_start = current_start - timedelta(weeks=1)
        compare_end = current_end - timedelta(weeks=1)
    elif compare_with == "last_month":
        compare_start = current_start - timedelta(days=30)
        compare_end = current_end - timedelta(days=30)
    else:
        raise HTTPException(status_code=400, detail="Invalid comparison period")

    # Get stats for both periods
    current_query = db.query(func.count(Student.id)).filter(
        Student.created_at >= current_start,
        Student.created_at <= current_end
    )
    compare_query = db.query(func.count(Student.id)).filter(
        Student.created_at >= compare_start,
        Student.created_at <= compare_end
    )

    if current_user.role != 'admin':
        current_query = current_query.filter(Student.created_by_user_id == current_user.id)
        compare_query = compare_query.filter(Student.created_by_user_id == current_user.id)

    current_count = current_query.scalar() or 0
    compare_count = compare_query.scalar() or 0

    # Calculate growth
    growth_rate = 0
    if compare_count > 0:
        growth_rate = ((current_count - compare_count) / compare_count) * 100
    elif current_count > 0:
        growth_rate = 100

    # Debug: Log the comparison for troubleshooting
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Comparison: current={current_count} ({current_start.date()} to {current_end.date()}), compare={compare_count} ({compare_start.date()} to {compare_end.date()})")

    return {
        "current_period": {
            "start": current_start.isoformat(),
            "end": current_end.isoformat(),
            "count": current_count
        },
        "compare_period": {
            "start": compare_start.isoformat(),
            "end": compare_end.isoformat(),
            "count": compare_count
        },
        "growth": {
            "absolute": current_count - compare_count,
            "percentage": round(growth_rate, 1)
        },
        "compare_with": compare_with
    }


@router.get("/range")
async def get_range_stats(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get statistics for a custom date range"""
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="Start date must be before end date")

    # Base query
    query = db.query(Student).filter(
        Student.created_at >= start_dt,
        Student.created_at <= end_dt
    )

    # Teachers see only their own students
    if current_user.role != 'admin':
        query = query.filter(Student.created_by_user_id == current_user.id)

    # Get all students in range
    students = query.all()

    # Calculate stats
    total = len(students)
    tours = len([s for s in students if s.wants_tour])

    # By department
    dept_stats = {}
    for student in students:
        dept_name = student.department.name if student.department else "Belirtilmemiş"
        dept_stats[dept_name] = dept_stats.get(dept_name, 0) + 1

    # By YKS type
    type_stats = {}
    for student in students:
        if student.yks_type:
            type_stats[student.yks_type] = type_stats.get(student.yks_type, 0) + 1

    # By day
    daily_stats = {}
    for student in students:
        date_key = student.created_at.strftime("%Y-%m-%d")
        daily_stats[date_key] = daily_stats.get(date_key, 0) + 1

    # Hourly distribution
    hourly_stats = {}
    for student in students:
        hour_key = student.created_at.hour
        hourly_stats[hour_key] = hourly_stats.get(hour_key, 0) + 1

    return {
        "period": {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "days": (end_dt - start_dt).days + 1
        },
        "summary": {
            "total_students": total,
            "tour_requests": tours,
            "unique_departments": len(dept_stats)
        },
        "by_department": [
            {"department_name": k, "count": v}
            for k, v in sorted(dept_stats.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_type": [
            {"yks_type": k, "count": v}
            for k, v in sorted(type_stats.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_day": [
            {"date": k, "count": v}
            for k, v in sorted(daily_stats.items())
        ],
        "by_hour": [
            {"hour": h, "count": hourly_stats.get(h, 0)}
            for h in range(24)
        ]
    }


@router.get("/heatmap")
async def get_heatmap_data(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get heat map data: day of week × hour of day"""
    start_date = turkey_now() - timedelta(days=days)

    # Query all students in range
    query = db.query(Student).filter(Student.created_at >= start_date)

    if current_user.role != 'admin':
        query = query.filter(Student.created_by_user_id == current_user.id)

    students = query.all()

    # Build heatmap matrix (7 days × 24 hours)
    # Days: 0=Monday, 6=Sunday (Python datetime)
    heatmap = {}
    for student in students:
        day_of_week = student.created_at.weekday()
        hour = student.created_at.hour
        key = f"{day_of_week}-{hour}"
        heatmap[key] = heatmap.get(key, 0) + 1

    # Convert to format expected by frontend
    result = []
    day_names = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
    for day in range(7):
        for hour in range(24):
            key = f"{day}-{hour}"
            result.append({
                "day_of_week": day,
                "day_name": day_names[day],
                "hour": hour,
                "count": heatmap.get(key, 0)
            })

    return {
        "period_days": days,
        "data": result,
        "max_count": max([r["count"] for r in result]) if result else 0
    }


@router.get("/department-trends")
async def get_department_trends(
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze"),
    limit: int = Query(10, ge=1, le=20, description="Number of top departments"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get department performance trends over time"""
    start_date = turkey_now() - timedelta(days=days)

    # Get department stats by day
    query = db.query(
        func.date(Student.created_at).label("date"),
        Department.name.label("department_name"),
        func.count(Student.id).label("count")
    ).outerjoin(
        Student, Department.id == Student.department_id
    ).filter(
        Student.created_at >= start_date
    )

    if current_user.role != 'admin':
        query = query.filter(Student.created_by_user_id == current_user.id)

    results = query.group_by("date", Department.id, Department.name).order_by("date").all()

    # Build trends data
    trends = {}
    all_dates = set()

    for row in results:
        dept_name = row.department_name or "Belirtilmemiş"
        # SQLite func.date() returns string, not date object
        date_str = row.date if isinstance(row.date, str) else row.date.strftime("%Y-%m-%d")
        all_dates.add(date_str)

        if dept_name not in trends:
            trends[dept_name] = {}
        trends[dept_name][date_str] = row.count

    # Get total counts to find top departments
    dept_totals = {}
    for dept_name, dates in trends.items():
        dept_totals[dept_name] = sum(dates.values())

    # Get top departments
    top_depts = sorted(dept_totals.items(), key=lambda x: x[1], reverse=True)[:limit]

    # Fill in missing dates with 0
    sorted_dates = sorted(all_dates)
    for dept_name in trends:
        for date_str in sorted_dates:
            if date_str not in trends[dept_name]:
                trends[dept_name][date_str] = 0

    return {
        "period_days": days,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": turkey_now().strftime("%Y-%m-%d"),
        "top_departments": [
            {"department_name": dept, "total": total}
            for dept, total in top_depts
        ],
        "trends": {
            dept: {
                "data": [
                    {"date": date, "count": trends[dept].get(date, 0)}
                    for date in sorted_dates
                ]
            }
            for dept, _ in top_depts
        }
    }


def _parse_date_range(start_date: Optional[str], end_date: Optional[str], default_date: datetime):
    """Helper to parse date range parameters"""
    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            return start_dt, end_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        # Default to last 7 days
        end = default_date.replace(hour=23, minute=59, second=59)
        start = end - timedelta(days=6)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, end


@router.get("/day/{date_str}", response_model=StatsResponse)
async def get_day_stats(
    date_str: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get statistics for a specific day.
    Date format: YYYY-MM-DD or DD.MM.YYYY
    """
    # Parse date - try both formats
    try:
        if '.' in date_str:
            date_parts = date_str.split('.')
            target_date = datetime(int(date_parts[2]), int(date_parts[1]), int(date_parts[0])).date()
        else:
            date_parts = date_str.split('-')
            target_date = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2])).date()
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid date format. Use DD.MM.YYYY or YYYY-MM-DD")

    # Start and end of the target date
    from datetime import time
    start_datetime = datetime.combine(target_date, time.min)
    end_datetime = datetime.combine(target_date, time.max)

    # Base query for this day
    day_query = db.query(Student).filter(
        Student.created_at >= start_datetime,
        Student.created_at <= end_datetime
    )

    # Teachers see only their own students
    if current_user.role != 'admin':
        day_query = day_query.filter(Student.created_by_user_id == current_user.id)

    # Summary for this day
    day_students = day_query.all()
    total_count = len(day_students)

    # Calculate unique for this day's data
    unique_count = total_count  # For a single day, treat each record as unique for now
    # (Could add deduplication logic here if needed)

    summary = StatsSummary(
        total_students=total_count,
        unique_students=unique_count,
        today_count=total_count,
        tour_requests=len([s for s in day_students if s.wants_tour]),
        unique_departments=len(set([s.department_id for s in day_students if s.department_id]))
    )

    # Data quality for this day's data
    incomplete = len([s for s in day_students if not s.email or not s.phone or not s.department_id])
    quality_score = round((total_count - incomplete) / total_count * 100, 1) if total_count > 0 else 100.0
    data_quality = DataQualityStats(
        incomplete_records=incomplete,
        duplicate_emails=0,  # Not calculated for single day
        duplicate_phones=0,
        quality_score=quality_score
    )

    # By department for this day
    dept_results = db.query(
        Department.name,
        func.count(Student.id).label("count")
    ).outerjoin(Student, Department.id == Student.department_id).filter(
        Student.created_at >= start_datetime,
        Student.created_at <= end_datetime
    )
    if current_user.role != 'admin':
        dept_results = dept_results.filter(Student.created_by_user_id == current_user.id)
    dept_results = dept_results.group_by(Department.id, Department.name).order_by(desc("count")).limit(10).all()
    by_department = [
        DepartmentStats(department_name=row.name or "Belirtilmemiş", count=row.count or 0)
        for row in dept_results
    ]

    # By type for this day
    type_results = db.query(
        Student.yks_type,
        func.count(Student.id).label("count")
    ).filter(
        Student.yks_type.isnot(None),
        Student.created_at >= start_datetime,
        Student.created_at <= end_datetime
    )
    if current_user.role != 'admin':
        type_results = type_results.filter(Student.created_by_user_id == current_user.id)
    type_results = type_results.group_by(Student.yks_type).all()
    by_type = [
        YksTypeStats(yks_type=row.yks_type, count=row.count)
        for row in type_results
    ]

    # Tour requests for this day
    tour_results = db.query(
        Department.name.label("department_name"),
        func.count(Student.id).label("tour_requests")
    ).outerjoin(Student, Department.id == Student.department_id).filter(
        Student.wants_tour == True,
        Student.created_at >= start_datetime,
        Student.created_at <= end_datetime
    )
    if current_user.role != 'admin':
        tour_results = tour_results.filter(Student.created_by_user_id == current_user.id)
    tour_results = tour_results.group_by(Department.id, Department.name).all()
    tour_requests = []
    for row in tour_results:
        total = db.query(func.count(Student.id)).filter(
            Student.department_id == Department.id,
            Student.created_at >= start_datetime,
            Student.created_at <= end_datetime
        )
        if current_user.role != 'admin':
            total = total.filter(Student.created_by_user_id == current_user.id)
        total = total.scalar() or 0
        tour_requests.append(TourRequestStats(
            department_name=row.department_name,
            tour_requests=row.tour_requests,
            total_students=total
        ))

    # Hourly for this day
    hourly_results = db.query(
        func.extract("hour", Student.created_at).label("hour"),
        func.count(Student.id).label("count")
    ).filter(
        Student.created_at >= start_datetime,
        Student.created_at <= end_datetime
    )
    if current_user.role != 'admin':
        hourly_results = hourly_results.filter(Student.created_by_user_id == current_user.id)
    hourly_results = hourly_results.group_by("hour").order_by("hour").all()
    hourly = [
        HourlyStats(hour=int(row.hour), count=row.count)
        for row in hourly_results
    ]

    # By teacher for this day
    teacher_results = db.query(
        User.id.label("user_id"),
        User.username,
        func.count(Student.id).label("count")
    ).outerjoin(
        Student, User.id == Student.created_by_user_id
    ).filter(
        User.role.in_(["teacher", "admin"]),
        Student.created_at >= start_datetime,
        Student.created_at <= end_datetime
    ).group_by(
        User.id, User.username
    ).order_by(desc("count")).all()
    by_teacher = []
    for row in teacher_results:
        by_teacher.append(TeacherStats(
            user_id=row.user_id,
            username=row.username,
            count=row.count or 0,
            today_count=row.count or 0  # For this day, today_count = total count
        ))

    return StatsResponse(
        summary=summary,
        data_quality=data_quality,
        by_department=by_department,
        by_type=by_type,
        tour_requests=tour_requests,
        hourly=hourly,
        by_teacher=by_teacher
    )
