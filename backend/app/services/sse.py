import asyncio
import json
from typing import List, Dict
from fastapi import Request


class SSEManager:
    """Manages Server-Sent Events connections for real-time updates"""

    def __init__(self):
        self._clients: List[asyncio.Queue] = []

    async def subscribe(self):
        """Subscribe a new client to SSE events"""
        queue = asyncio.Queue()
        self._clients.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        """Unsubscribe a client from SSE events"""
        if queue in self._clients:
            self._clients.remove(queue)

    def broadcast(self, event: Dict):
        """Broadcast an event to all connected clients"""
        message = f"data: {json.dumps(event)}\n\n"
        for client in self._clients[:]:  # Create a copy to avoid modification during iteration
            try:
                # Try to put message in queue without blocking
                client.put_nowait(message)
            except asyncio.QueueFull:
                # Remove client if queue is full (disconnected)
                self._clients.remove(client)

    async def event_generator(self):
        """Generate SSE events for connected clients"""
        try:
            queue = await self.subscribe()
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
