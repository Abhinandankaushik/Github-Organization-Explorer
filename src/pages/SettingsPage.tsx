import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Trash2, Database, Shield, HardDrive, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { useNavigate } from 'react-router-dom';
import { OrgManager } from '@/components/OrgManager';

export default function SettingsPage() {
  const { pat, setPat, orgName, clearData, rateLimit } = useAppStore();
  const navigate = useNavigate();
  const [newPat, setNewPat] = useState('');
  const [showToken, setShowToken] = useState(false);

  const maskedPat = pat ? `ghp_${'●'.repeat(20)}${pat.slice(-4)}` : 'Not set';

  const handleUpdatePat = () => {
    if (newPat) {
      setPat(newPat);
      setNewPat('');
    }
  };

  const handleSignOut = () => {
    clearData();
    navigate('/');
  };

  const handleClearCache = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('etag:') || key.startsWith('cache:')) {
        localStorage.removeItem(key);
      }
    });
  };

  // Estimate storage
  const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('cache:'));
  const estimatedSize = cacheKeys.reduce((s, k) => s + (localStorage.getItem(k)?.length || 0), 0);
  const sizeMB = (estimatedSize / (1024 * 1024)).toFixed(2);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">PAT management, cache controls, and storage</p>
      </motion.div>

      {/* PAT Section */}
      <div className="bg-surface-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Personal Access Token</h3>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between bg-surface-page rounded-lg px-3 py-2">
            <span className="text-xs font-mono text-muted-foreground">{maskedPat}</span>
            <button onClick={() => setShowToken(!showToken)} className="text-[10px] text-primary">
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          {showToken && pat && (
            <p className="text-[10px] font-mono text-muted-foreground bg-surface-page rounded px-3 py-1 break-all">{pat}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            type="password"
            value={newPat}
            onChange={e => setNewPat(e.target.value)}
            placeholder="New token (ghp_...)"
            className="bg-surface-page border-border font-mono text-xs flex-1"
          />
          <Button onClick={handleUpdatePat} disabled={!newPat} size="sm">Update</Button>
        </div>

        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p className="flex items-center gap-1"><Shield className="w-3 h-3" /> Required: <span className="font-mono">public_repo, read:org</span></p>
          <p>Token stored only in localStorage. Transmitted only to api.github.com via HTTPS.</p>
        </div>
      </div>

      {/* Rate Limit */}
      <div className="bg-surface-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">API Rate Limit</h3>
        <div className="relative w-full h-3 bg-surface-overlay rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full gradient-primary transition-all"
            style={{ width: `${(rateLimit.remaining / Math.max(1, rateLimit.limit)) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="font-mono">{rateLimit.remaining} / {rateLimit.limit} remaining</span>
          {rateLimit.resetAt > 0 && (
            <span>Resets: {new Date(rateLimit.resetAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Cache */}
      <div className="bg-surface-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Cache Storage</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClearCache} className="text-xs text-destructive gap-1">
            <Trash2 className="w-3 h-3" /> Clear Cache
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-surface-page rounded-lg p-3">
            <p className="text-muted-foreground">Cached Endpoints</p>
            <p className="text-lg font-mono text-foreground">{cacheKeys.length}</p>
          </div>
          <div className="bg-surface-page rounded-lg p-3">
            <p className="text-muted-foreground">Storage Used</p>
            <p className="text-lg font-mono text-foreground">{sizeMB} MB</p>
          </div>
        </div>
      </div>

      {/* Organization */}
      <div className="bg-surface-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Current Organization</h3>
        <p className="text-sm font-mono text-primary">{orgName || 'None'}</p>
      </div>

      {/* Org Manager */}
      <OrgManager />

      {/* Sign Out */}
      <Button variant="destructive" onClick={handleSignOut} className="gap-2">
        <LogOut className="w-4 h-4" />
        Sign Out & Clear Data
      </Button>
    </div>
  );
}
