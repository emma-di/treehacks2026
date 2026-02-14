import { Building2 } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useEffect, useRef, useState } from 'react';

const navigationItems = [
  { name: 'Hospital', path: '/hospital' },
  { name: 'Patient', path: '/patient' },
  { name: 'Provider', path: '/provider' },
  { name: 'Agent', path: '/agent' },
];

export function Header() {
  const location = useLocation();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const currentIndex = navigationItems.findIndex(item => item.path === location.pathname);
    if (currentIndex !== -1 && navRefs.current[currentIndex]) {
      const element = navRefs.current[currentIndex];
      if (element) {
        setIndicatorStyle({
          left: element.offsetLeft,
          width: element.offsetWidth,
        });
      }
    }
  }, [location.pathname]);

  return (
    <header className="bg-gradient-to-r from-blue-600 via-blue-400 to-white shadow-md">
      <div className="px-6 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          {/* Logo and Hospital Name */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="bg-white/30 p-2 rounded-lg backdrop-blur-sm">
              <Building2 className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Hospital Name</h1>
              <p className="text-xs text-white/90">Multi-Agent Allocator</p>
            </div>
          </Link>

          {/* Navigation with sliding indicator */}
          <nav className="relative flex items-center gap-1">
            {navigationItems.map((item, index) => (
              <Link
                key={item.path}
                to={item.path}
                ref={(el) => (navRefs.current[index] = el)}
                className={`px-6 py-2 rounded-t-lg transition-colors relative z-10 ${
                  location.pathname === item.path
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
        </div>
      </div>
    </header>
  );
}