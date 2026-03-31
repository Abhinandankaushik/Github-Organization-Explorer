import { RefreshCw, Wifi, WifiOff, Menu, X } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Topbar({ isSidebarOpen, onToggleSidebar }: TopbarProps) {
  const navigate = useNavigate();
  const { org, syncData, isLoading, rateLimit } = useAppStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await syncData();
    setSyncing(false);
  };

  return (
    <header className="h-12 sm:h-14 glass sticky top-0 z-40 flex items-center justify-between px-3 sm:px-4 md:px-6 border-b border-border/50 shadow-[0_4px_20px_hsl(0_0%_0%/0.1)]">
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="rounded-lg hover:bg-accent hover:text-foreground transition-colors p-2 h-9 w-9"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
        {org && (
          <motion.button 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0 min-w-0"
            onClick={() => navigate('/dashboard')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.img 
              src={org.avatar_url} 
              alt={org.login} 
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-border flex-shrink-0" 
              whileHover={{ scale: 1.1 }}
            />
            <span className="text-xs sm:text-sm font-semibold text-foreground gradient-text truncate">{org.name || org.login}</span>
          </motion.button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {!isOnline && (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium border border-warning/30">
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
        {isOnline && (
          <motion.div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1.5 rounded-full bg-surface-card/50 border border-border">
            <Wifi className="w-3 h-3 text-success" />
            <span className="font-mono font-semibold">{rateLimit.remaining}</span>
          </motion.div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncing || isLoading}
          className="text-xs gap-1 sm:gap-1.5 hover:bg-accent hover:text-foreground transition-all h-9"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync</span>
        </Button>
      </div>
    </header>
  );
}
