"""
Seed data for SQLite database.
This script runs on startup if the database is empty.
"""

from .database import SessionLocal
from .models import User, Department, Student
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed_database():
    """Populate database with initial data"""
    db = SessionLocal()

    try:
        # Check if admin user exists
        admin_exists = db.query(User).filter(User.username == "Özgür Güler").first()
        if not admin_exists:
            # Create default admin user
            admin = User(
                username="Özgür Güler",
                password_hash=pwd_context.hash("admin123"),
                role="admin"
            )
            db.add(admin)
            db.commit()
            print("Created default admin user: Özgür Güler / admin123")
        else:
            print("Admin user already exists")

        # Check if teacher user exists
        teacher_exists = db.query(User).filter(User.username == "Okan").first()
        if not teacher_exists:
            # Create default teacher user
            teacher = User(
                username="Okan",
                password_hash=pwd_context.hash("teacher123"),
                role="teacher"
            )
            db.add(teacher)
            db.commit()
            print("Created default teacher user: Okan / teacher123")
        else:
            print("Teacher user already exists")

        # Check if departments exist
        dept_count = db.query(Department).count()
        if dept_count == 0:
            departments = [
                Department(name="Bilgisayar Mühendisliği", active=True),
                Department(name="Yazılım Mühendisliği", active=True),
                Department(name="Elektrik-Elektronik Mühendisliği", active=True),
                Department(name="Makine Mühendisliği", active=True),
                Department(name="İnşaat Mühendisliği", active=True),
                Department(name="Endüstri Mühendisliği", active=True),
                Department(name="Kimya Mühendisliği", active=True),
                Department(name="Çevre Mühendisliği", active=True),
                Department(name="Eczacılık", active=True),
                Department(name="Tıp", active=True),
                Department(name="Diş Hekimliği", active=True),
                Department(name="Hemşirelik", active=True),
                Department(name="Hukuk", active=True),
                Department(name="İktisat", active=True),
                Department(name="İşletme", active=True),
                Department(name="Psikoloji", active=True),
                Department(name="Eğitim Bilimleri", active=True),
                Department(name="Güzel Sanatlar", active=True),
                Department(name="Mimarlık", active=True),
                Department(name="Şehir ve Bölge Planlama", active=True),
            ]
            db.add_all(departments)
            db.commit()
            print(f"Created {len(departments)} departments")
        else:
            print(f"Departments already exist: {dept_count} found")

        print("Database seeding completed!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
