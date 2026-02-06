import asyncio
import json
from typing import List, Dict, Optional
from fastapi import Request


class SSEManager:
    """Manages Server-Sent Events connections for real-time updates"""

    def __init__(self):
        self._clients: Dict[asyncio.Queue, Optional[int]] = {}  # queue -> user_id mapping

    async def subscribe(self, user_id: Optional[int] = None):
        """Subscribe a new client to SSE events"""
        queue = asyncio.Queue()
        self._clients[queue] = user_id
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        """Unsubscribe a client from SSE events"""
        if queue in self._clients:
            del self._clients[queue]

    def broadcast(self, event: Dict):
        """Broadcast an event to all connected clients"""
        message = f"data: {json.dumps(event)}\n\n"
        for queue in list(self._clients.keys()):  # Create a copy to avoid modification during iteration
            try:
                # Try to put message in queue without blocking
                queue.put_nowait(message)
            except asyncio.QueueFull:
                # Remove client if queue is full (disconnected)
                self.unsubscribe(queue)
            except KeyError:
                # Client was already removed
                pass

    async def event_generator(self, user_id: Optional[int] = None):
        """Generate SSE events for connected clients"""
        try:
            queue = await self.subscribe(user_id)
            while True:
                message = await queue.get()
                yield message
        except asyncio.CancelledError:
            self.unsubscribe(queue)
        except Exception as e:
            print(f"SSE error: {e}")
            self.unsubscribe(queue)


# Global SSE manager instance
manager = SSEManager()
