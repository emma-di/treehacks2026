'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Trash2, Activity } from 'lucide-react';

interface Event {
    type: string;
    timestamp: number;
    data: any;
}

export default function Agent() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const eventsEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!isPaused) {
            scrollToBottom();
        }
    }, [events, isPaused]);

    useEffect(() => {
        // Connect to SSE
        const connectSSE = () => {
            console.log('Connecting to event stream...');
            const eventSource = new EventSource('/api/agent-events');
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log('Connected to event stream');
                setIsConnected(true);
            };

            eventSource.onmessage = (e) => {
                if (e.data && e.data !== ': keepalive') {
                    try {
                        const event: Event = JSON.parse(e.data);
                        console.log('Received event:', event.type);
                        setEvents(prev => [...prev, event]);

                        // Ensure connected status is set
                        if (!isConnected) {
                            setIsConnected(true);
                        }
                    } catch (err) {
                        console.error('Failed to parse event:', err);
                    }
                }
            };

            eventSource.onerror = (err) => {
                console.error('SSE error:', err);
                setIsConnected(false);
                eventSource.close();
                // Reconnect after 3 seconds
                console.log('Reconnecting in 3 seconds...');
                setTimeout(connectSSE, 3000);
            };
        };

        connectSSE();

        return () => {
            console.log('Cleaning up event stream connection');
            eventSourceRef.current?.close();
        };
    }, [isConnected]);

    const clearEvents = async () => {
        setEvents([]);
        try {
            await fetch('/api/agent-events', { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to clear events:', err);
        }
    };

    const getEventStyle = (type: string) => {
        const styles: Record<string, string> = {
            pipeline_start: 'bg-blue-50 border-l-4 border-blue-500 text-blue-900',
            pipeline_complete: 'bg-green-50 border-l-4 border-green-500 text-green-900',
            patient_start: 'bg-purple-50 border-l-4 border-purple-500 text-purple-900',
            patient_complete: 'bg-purple-50 border-l-4 border-purple-400 text-purple-800',
            model_call: 'bg-orange-50 border-l-4 border-orange-500 text-orange-900',
            model_result: 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-900',
            nurse_scheduling_start: 'bg-cyan-50 border-l-4 border-cyan-500 text-cyan-900',
            nurse_scheduling_complete: 'bg-teal-50 border-l-4 border-teal-500 text-teal-900',
            validation_warning: 'bg-red-50 border-l-4 border-red-500 text-red-900',
            validation_success: 'bg-green-50 border-l-4 border-green-400 text-green-800',
        };
        return styles[type] || 'bg-gray-50 border-l-4 border-gray-500 text-gray-900';
    };

    const getEventIcon = (type: string) => {
        if (type.includes('model')) return '🤖';
        if (type.includes('patient')) return '👤';
        if (type.includes('nurse')) return '👨‍⚕️';
        if (type.includes('pipeline')) return '⚙️';
        if (type.includes('validation')) return '✓';
        return '📋';
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleTimeString();
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="p-6 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="size-8 text-blue-600" />
                        <h2 className="text-3xl font-semibold text-gray-900">
                            Multi-Agent System Monitor
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className={`size-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-sm text-gray-600">
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsPaused(!isPaused)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            onClick={clearEvents}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            <Trash2 className="size-4" />
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 mx-6 mb-6 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-700">
                            Event Stream
                        </h3>
                        <span className="text-sm text-gray-600">
                            {events.length} events
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-900 font-mono text-sm">
                    {events.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            <Activity className="size-12 mx-auto mb-2 opacity-50" />
                            <p>No events yet. Run the pipeline to see activity.</p>
                        </div>
                    ) : (
                        events.map((event, idx) => (
                            <div
                                key={idx}
                                className={`p-3 rounded ${getEventStyle(event.type)} transition-all duration-300`}
                                style={{
                                    animation: idx === events.length - 1 ? 'slideIn 0.3s ease-out' : 'none'
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">{getEventIcon(event.type)}</span>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold">{event.type}</span>
                                            <span className="text-xs opacity-75">
                                                {formatTimestamp(event.timestamp)}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            {event.data.message || JSON.stringify(event.data)}
                                        </div>
                                        {event.data.patient_id && (
                                            <div className="text-xs mt-1 opacity-75">
                                                Patient: {event.data.patient_id}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={eventsEndRef} />
                </div>
            </div>

            <style jsx>{`
                    @keyframes slideIn {
                        from {
                            opacity: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                `}</style>
        </div>
    );
}
