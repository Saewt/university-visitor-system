import httpx
from typing import Optional
from ..config import get_settings
from ..models import Student, Department
from sqlalchemy.orm import Session

settings = get_settings()


async def send_telegram_message(chat_id: str, message: str) -> bool:
    """Send a message to a Telegram chat"""
    if settings.mock_telegram:
        # Use mock implementation for testing
        from .mock_telegram import send_mock_telegram_message
        return send_mock_telegram_message(chat_id, message)

    if not settings.telegram_bot_token:
        print("Warning: TELEGRAM_BOT_TOKEN not configured")
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "HTML"
                },
                timeout=10.0
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Failed to send Telegram message: {e}")
            return False


def send_tour_notification(student: Student, db: Session) -> bool:
    """
    Send tour request notification to the department's Telegram group.

    NOTE: This function is synchronous but should be called from a background task
    to avoid blocking the main event loop. Use FastAPI's BackgroundTasks.
    """
    if not student.department_id:
        print("No department specified, skipping notification")
        return False

    department = db.query(Department).filter(
        Department.id == student.department_id
    ).first()

    if not department or not department.telegram_chat_id:
        print(f"No Telegram chat ID for department {student.department_id if department else 'N/A'}")
        return False

    # Format the message
    message = f"""🔔 <b>Yeni Tur Talebi</b>

👤 <b>Öğrenci:</b> {student.first_name} {student.last_name}
📚 <b>Bölüm:</b> {department.name}
📱 <b>Telefon:</b> {student.phone or 'Belirtilmemiş'}
📧 <b>E-posta:</b> {student.email or 'Belirtilmemiş'}
🏫 <b>Lise:</b> {student.high_school or 'Belirtilmemiş'}
📊 <b>YKS Puanı:</b> {float(student.yks_score) if student.yks_score else 'Belirtilmemiş'}
📝 <b>YKS Türü:</b> {student.yks_type or 'Belirtilmemiş'}

⏰ <b>Kayıt Zamanı:</b> {student.created_at.strftime('%d.%m.%Y %H:%M')}
"""

    # Return the async function for background task execution
    # The caller should use BackgroundTasks to run this
    return _send_notification_async(department.telegram_chat_id, message)


async def _send_notification_async(chat_id: str, message: str) -> bool:
    """Async wrapper for sending Telegram notification"""
    return await send_telegram_message(chat_id, message)
