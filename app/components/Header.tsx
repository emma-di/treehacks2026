'use client';

import { Building2, Play, Loader2, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const navigationItems = [
    { name: 'Hospital', path: '/hospital/local' },
    { name: 'Patient', path: '/patient' },
    { name: 'Provider', path: '/provider' },
    { name: 'Agent', path: '/agent' },
];

export function Header() {
    const pathname = usePathname();
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const isHomePage = pathname === '/';

    // Scheduling button state
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState<'idle' | 'waiting' | 'running' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (isHomePage) return;
        const currentIndex = navigationItems.findIndex(item => item.path === pathname);
        if (currentIndex !== -1 && navRefs.current[currentIndex]) {
            const element = navRefs.current[currentIndex];
            if (element) {
                setIndicatorStyle({
                    left: element.offsetLeft,
                    width: element.offsetWidth,
                });
            }
        }
    }, [pathname, isHomePage]);

    const initiateScheduling = async () => {
        setIsRunning(true);
        setStatus('waiting');
        setMessage('Initializing...');

        try {
            const response = await fetch('/api/run-scheduling-async', {
                method: 'POST',
            });

            const data = await response.json();

            if (data.success) {
                setStatus('running');
                setMessage('Running! Check Agent tab');

                setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                }, 3000);
            } else {
                setStatus('error');
                setMessage('Failed - run manually');
            }
        } catch (error: any) {
            setStatus('error');
            setMessage('Error');
            console.error('Error:', error);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <header className="bg-gradient-to-r from-blue-600 via-blue-400 to-white shadow-md">
            <div className="px-6 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                    {/* Logo and brand / hospital name */}
                    <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                        <div className="bg-white/30 p-2 rounded-lg backdrop-blur-sm">
                            <Building2 className="size-6 text-white" />
                        </div>
                        <div>
                            {isHomePage ? (
                                <h1 className="text-xl font-semibold text-white">Multi-Agent Allocator</h1>
                            ) : (
                                <>
                                    <h1 className="text-xl font-semibold text-white">Hospital Name</h1>
                                    <p className="text-xs text-white/90">Multi-Agent Allocator</p>
                                </>
                            )}
                        </div>
                    </Link>

                    {/* Navigation and scheduling: only show on hospital/patient/provider/agent pages */}
                    {!isHomePage && (
                        <div className="flex items-center gap-4">
                            <nav className="relative flex items-center gap-1">
                                {navigationItems.map((item, index) => (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        ref={(el) => {
                                            navRefs.current[index] = el;
                                        }}
                                        className={`px-6 py-2 rounded-t-lg transition-colors relative z-10 ${pathname === item.path
                                            ? 'text-blue-900 font-medium'
                                            : 'text-blue-700 hover:text-blue-900'
                                            }`}
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                                {/* Thin line under all navigation items */}
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-300/40" />
                                {/* Sliding indicator bar */}
                                <div
                                    className="absolute bottom-0 h-[3px] bg-blue-900 transition-all duration-300 ease-out rounded-full z-20"
                                    style={{
                                        left: `${indicatorStyle.left}px`,
                                        width: `${indicatorStyle.width}px`,
                                    }}
                                />
                            </nav>
                            {/* Initiate Scheduling Button */}
                            <div className="flex items-center gap-2 pl-4 border-l border-white/30">
                                {status !== 'idle' && (
                                    <div className="flex items-center gap-1.5">
                                        {status === 'waiting' && <Loader2 className="size-3.5 text-white animate-spin" />}
                                        {status === 'running' && <CheckCircle className="size-3.5 text-white" />}
                                        {status === 'error' && <XCircle className="size-3.5 text-white" />}
                                        <span className="text-xs text-white">{message}</span>
                                    </div>
                                )}
                                <button
                                    onClick={initiateScheduling}
                                    disabled={isRunning}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm transition-all shadow-sm ${isRunning
                                        ? 'bg-blue-200 text-blue-400 border-blue-300 cursor-not-allowed'
                                        : 'bg-white text-blue-600 border-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-md'
                                        }`}
                                >
                                    {isRunning ? (
                                        <>
                                            <Loader2 className="size-3.5 animate-spin" />
                                            Running...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="size-3.5" />
                                            Initiate Scheduling
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
