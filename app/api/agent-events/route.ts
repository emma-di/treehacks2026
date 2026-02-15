import { NextRequest } from 'next/server';

// Force Node.js runtime for SSE
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple in-memory event store (matches backend event_stream.py concept)
interface Event {
  type: string;
  timestamp: number;
  data: any;
}

let events: Event[] = [];
let activeStreams: Array<ReadableStreamDefaultController> = [];

// Add event from external sources
export function addEvent(event: Event) {
  events.push(event);
  // Keep only last 1000 events
  if (events.length > 1000) {
    events = events.slice(-1000);
  }

  // Broadcast to all active streams
  const encoder = new TextEncoder();
  const message = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  activeStreams.forEach(controller => {
    try {
      controller.enqueue(message);
    } catch (e) {
      // Stream might be closed
    }
  });
}

// Clear all events
export function clearEvents() {
  events = [];
}

// GET: Server-Sent Events stream
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      activeStreams.push(controller);

      // Send existing events first
      events.forEach(event => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch (e) {
          // Stream might be closed
        }
      });

      // Send initial connected message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'connected',
        timestamp: Date.now() / 1000,
        data: { message: 'Connected to event stream' }
      })}\n\n`));

      // Keep connection alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch (e) {
          clearInterval(interval);
        }
      }, 15000);

      // Cleanup on close
      const cleanup = () => {
        clearInterval(interval);
        const idx = activeStreams.indexOf(controller);
        if (idx > -1) {
          activeStreams.splice(idx, 1);
        }
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      };

      request.signal.addEventListener('abort', cleanup);

      // Fallback cleanup after 5 minutes
      setTimeout(cleanup, 300000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// POST: Add new event (called from Python backend or manually)
export async function POST(request: NextRequest) {
  try {
    const event: Event = await request.json();
    addEvent(event);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Invalid event data' }, { status: 400 });
  }
}

// DELETE: Clear all events
export async function DELETE() {
  clearEvents();
  return Response.json({ success: true });
}
