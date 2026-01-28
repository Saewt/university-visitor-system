"""
Mock Telegram Service for Testing
Used when MOCK_TELEGRAM=true environment variable is set
"""


def send_mock_telegram_message(chat_id: str, message: str) -> bool:
    """Mock implementation that prints to console instead of sending real messages"""
    print(f"\n{'='*60}")
    print(f"📨 MOCK TELEGRAM MESSAGE")
    print(f"{'='*60}")
    print(f"Chat ID: {chat_id}")
    print(f"Message:")
    print("-" * 60)
    print(message)
    print("-" * 60)
    print(f"{'='*60}\n")
    return True
