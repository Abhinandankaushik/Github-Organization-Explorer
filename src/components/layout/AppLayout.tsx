import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isSidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen bg-surface-base relative overflow-hidden">
      {/* Background gradient animation */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-gradient-to-bl from-primary/5 via-transparent to-transparent blur-3xl" style={{ animation: 'float 30s ease-in-out infinite' }} />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full bg-gradient-to-tr from-info/3 via-transparent to-transparent blur-3xl" style={{ animation: 'float 35s ease-in-out infinite -7s' }} />
      </div>
      
      {/* Mobile Backdrop - Close sidebar when clicking outside */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <AppSidebar isOpen={isSidebarOpen} />
      <div
        className="transition-[margin] duration-300 relative z-0 md:ml-0"
        style={{ marginLeft: isSidebarOpen && !isMobile ? 240 : 0 }}
      >
        <Topbar isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setSidebarOpen(v => !v)} />
        <main className="p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
