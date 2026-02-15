"""
Event streaming for real-time monitoring of the multi-agent system.
Events are stored in memory and can be accessed via SSE API.
"""
import time
import os
from typing import Any
from collections import deque

# Global event queue (limited to last 1000 events)
_event_queue: deque[dict[str, Any]] = deque(maxlen=1000)
_event_listeners: list[Any] = []

# API endpoint for sending events to frontend
API_ENDPOINT = os.environ.get("NEXT_API_ENDPOINT", "http://localhost:3000/api/agent-events")
print(f"[EventStream] API endpoint configured: {API_ENDPOINT}")


def emit_event(event_type: str, data: dict[str, Any]) -> None:
    """
    Emit an event to all listeners and store in queue.
    Also sends to Next.js API if available.
    event_type: "agent_start", "model_call", "patient_analyzed", "agent_complete", etc.
    """
    event = {
        "type": event_type,
        "timestamp": time.time(),
        "data": data
    }
    _event_queue.append(event)
    
    # Send to Next.js API (non-blocking)
    try:
        import requests
        print(f"[Event] Emitting {event_type} to {API_ENDPOINT}")
        response = requests.post(API_ENDPOINT, json=event, timeout=0.5)
        print(f"[Event] Response status: {response.status_code}")
    except Exception as e:
        # Silently fail if API is not available
        print(f"[Event] Failed to send event: {e}")
        pass
    
    # Notify any active listeners (for SSE)
    for listener in _event_listeners:
        try:
            listener(event)
        except Exception:
            pass


def get_recent_events(count: int = 100) -> list[dict[str, Any]]:
    """Get the most recent events from the queue."""
    events = list(_event_queue)
    return events[-count:] if len(events) > count else events


def clear_events() -> None:
    """Clear all events from the queue."""
    _event_queue.clear()


def add_listener(callback: Any) -> None:
    """Add a callback that will be called when new events are emitted."""
    _event_listeners.append(callback)


def remove_listener(callback: Any) -> None:
    """Remove a callback listener."""
    if callback in _event_listeners:
        _event_listeners.remove(callback)
