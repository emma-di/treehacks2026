'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Trash2, Activity, Send, Bot } from 'lucide-react';

interface Event {
    type: string;
    timestamp: number;
    data: any;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export default function Agent() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

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

    const sendMessage = async () => {
        if (!inputMessage.trim() || isSending) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: inputMessage,
        };

        setChatMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsSending(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...chatMessages, userMessage],
                    agentLog: events,
                }),
            });

            const data = await response.json();

            if (data.message) {
                setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message.content,
                }]);
            } else {
                setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Error: ${data.error || 'Failed to get response'}`,
                }]);
            }
        } catch (error: any) {
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${error.message}`,
            }]);
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Derive patient list and per-patient progress from events
    const { patientList, nurseStatus } = (() => {
        const list: {
            id: string;
            model1Done: boolean;
            model2Done: boolean;
            roomDone: boolean;
            needsBed: boolean | null;
            lengthOfStay: number | null;
        }[] = [];
        const seen = new Set<string>();
        let nurseStarted = false;
        let nurseComplete = false;
        for (const e of events) {
            const pid = e.data?.patient_id;
            if (pid && !seen.has(pid)) {
                seen.add(pid);
                list.push({
                    id: pid,
                    model1Done: false,
                    model2Done: false,
                    roomDone: false,
                    needsBed: null,
                    lengthOfStay: null,
                });
            }
            const idx = list.findIndex(p => p.id === pid);
            if (idx >= 0) {
                if (e.type === 'model_result' && e.data?.model === 'Risk Assessment Model 1') {
                    list[idx].model1Done = true;
                    if (typeof e.data?.needs_bed === 'boolean') list[idx].needsBed = e.data.needs_bed;
                }
                if (e.type === 'model_result' && e.data?.model === 'Length of Stay Model 2') {
                    list[idx].model2Done = true;
                    const los = e.data?.length_of_stay;
                    if (typeof los === 'number' && los >= 0) list[idx].lengthOfStay = los;
                }
                if (e.type === 'patient_complete') list[idx].roomDone = true;
            }
            if (e.type === 'nurse_scheduling_start') nurseStarted = true;
            if (e.type === 'nurse_scheduling_complete') nurseComplete = true;
        }
        const nurseStatus: 'pending' | 'running' | 'done' = nurseComplete ? 'done' : nurseStarted ? 'running' : 'pending';
        return { patientList: list, nurseStatus };
    })();

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
            <div className="p-6 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="size-8 text-blue-600" />
                        <h2 className="text-3xl font-semibold text-gray-900">
                            Atria System Monitor
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

            {/* Two column layout */}
            <div className="flex-1 flex gap-4 px-6 pb-6 min-h-0 overflow-hidden">
                {/* Left: scrollable list of patient progress bars + nurse row */}
                <div className="flex-[0_0_65%] bg-white rounded-lg shadow-xl flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 min-h-0">
                        <div className="space-y-4">
                            {patientList.map((p) => (
                                <div key={p.id} className="flex-shrink-0">
                                    <div className="text-sm font-semibold text-gray-800 mb-1 truncate" title={p.id}>
                                        Patient {p.id}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0 h-7 rounded-lg overflow-hidden bg-blue-50 flex">
                                            <div
                                                className={`h-full transition-all duration-300 ${p.model1Done ? 'bg-blue-200' : 'bg-blue-100'}`}
                                                style={{ width: '33.33%' }}
                                            title="Risk agent: Needs bed?"
                                        />
                                            <div
                                                className={`h-full transition-all duration-300 ${p.model2Done ? 'bg-blue-300' : 'bg-blue-100/80'}`}
                                                style={{ width: '33.33%' }}
                                                title="Risk agent: Length of stay"
                                        />
                                            <div
                                                className={`h-full transition-all duration-300 ${p.roomDone ? 'bg-sky-200' : 'bg-sky-100'}`}
                                                style={{ width: '33.33%' }}
                                                title="Patient agent: Room"
                                        />
                                        </div>
                                        <span className="text-xs text-gray-500 w-8 flex-shrink-0">
                                            {[p.model1Done, p.model2Done, p.roomDone].filter(Boolean).length}/3
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                                        {p.needsBed === true && 'Needs bed'}
                                        {p.needsBed === false && "Doesn't need bed"}
                                        {p.needsBed === null && '—'}
                                        {' · '}
                                        {p.lengthOfStay !== null && p.lengthOfStay >= 0 ? `${p.lengthOfStay} h` : '—'}
                                        {' · '}
                                        Room{p.roomDone ? ' done' : ' —'}
                                    </p>
                                </div>
                            ))}
                            {/* Nurse agent - last row (runs after all patients; done by end of scheduling) */}
                            <div className="flex-shrink-0 pt-3 mt-3 border-t border-blue-100">
                                <div className="text-sm font-semibold text-gray-800 mb-1">Nurse agent</div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0 h-7 rounded-lg overflow-hidden bg-blue-50">
                                        <div
                                            className={`h-full transition-all duration-300 ${nurseStatus === 'done' ? 'bg-blue-400' : nurseStatus === 'running' ? 'bg-blue-200' : 'bg-blue-100'}`}
                                            style={{
                                                width: nurseStatus === 'done' ? '100%' : nurseStatus === 'running' ? '50%' : '0%',
                                            }}
                                            title={nurseStatus === 'done' ? 'Assigns nurses to rooms — done' : nurseStatus === 'running' ? 'Assigning nurses to rooms...' : 'Runs after all patients'}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">
                                        {nurseStatus === 'done' ? 'Done' : nurseStatus === 'running' ? 'In progress' : 'Pending'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                                    Assigns nurses to rooms (runs after all patients)
                                </p>
                            </div>
                        </div>
                        {patientList.length === 0 && nurseStatus === 'pending' && (
                            <div className="text-center text-gray-400 py-12 text-sm">
                                Run the pipeline to see patient progress.
                            </div>
                        )}
                    </div>
                </div>

                {/* Chatbot - Right side (35%) */}
                <div className="flex-[0_0_35%] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b bg-gradient-to-r from-blue-600 via-blue-400 to-white shadow-md flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Bot className="size-6 text-white" />
                            <h3 className="text-lg font-semibold text-white">
                                Agent Analysis
                            </h3>
                        </div>
                        <p className="text-xs text-white/80 mt-1">
                            Ask questions about the pipeline events
                        </p>
                    </div>

                    {/* Chat messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {chatMessages.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <Bot className="size-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Ask me anything about the agent activity!</p>
                                <p className="text-xs mt-2 text-gray-400">
                                    Example: "How many patients were assigned?"
                                </p>
                            </div>
                        ) : (
                            chatMessages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-lg px-4 py-2 ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border border-gray-200 text-gray-800'
                                            }`}
                                    >
                                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                                    </div>
                                </div>
                            ))
                        )}
                        {isSending && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <div className="flex gap-1">
                                            <div className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="p-4 border-t bg-white flex-shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder="Ask about the pipeline events..."
                                disabled={isSending}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isSending || !inputMessage.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <Send className="size-4" />
                            </button>
                        </div>
                    </div>
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
