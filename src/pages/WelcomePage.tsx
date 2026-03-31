import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Key, ChevronDown, ChevronUp, ArrowRight, Shield, Zap, Eye, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';

export default function WelcomePage() {
  const { setPat, setOrgName, setMode, addOrg, setSelectedOrgs, loadOrg, loadMultipleOrgs } = useAppStore();
  const navigate = useNavigate();
  
  const [org, setOrg] = useState('');
  const [orgs, setOrgs] = useState<string[]>([]);
  const [token, setToken] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMultiMode, setIsMultiMode] = useState(false);

  const validateOrgName = (name: string) => /^[a-zA-Z0-9._-]+$/.test(name) && name.length <= 39;

  const handleAddOrg = () => {
    if (!validateOrgName(org)) {
      setError('Invalid org name. Use only letters, numbers, hyphens, underscores, and dots.');
      return;
    }
    if (orgs.includes(org)) {
      setError('Organization already added.');
      return;
    }
    setOrgs([...orgs, org]);
    addOrg(org);
    setOrg('');
    setError('');
  };

  const handleRemoveOrg = (orgName: string) => {
    setOrgs(orgs.filter(o => o !== orgName));
  };

  const handleExplore = async () => {
    if (isMultiMode && orgs.length === 0) {
      setError('Add at least one organization.');
      return;
    }
    if (!isMultiMode && !validateOrgName(org)) {
      setError('Invalid org name. Use only letters, numbers, hyphens, underscores, and dots.');
      return;
    }

    setLoading(true);
    setError('');
    setPat(token);
    
    try {
      if (isMultiMode) {
        setMode('multi');
        setSelectedOrgs(orgs);
        await loadMultipleOrgs(orgs);
      } else {
        setMode('single');
        setOrgName(org);
        // Ensure single org is added to orgs list so it appears in multi-mode later
        addOrg(org);
        await loadOrg(org);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(240 15% 3%) 0%, hsl(235 20% 8%) 50%, hsl(240 15% 3%) 100%)',
        backgroundSize: '200% 200%',
        animation: 'gradient-shift 15s ease infinite'
      }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-gradient-to-br from-primary/10 via-transparent to-transparent blur-3xl animate-pulse" style={{ animation: 'float 20s ease-in-out infinite' }} />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-gradient-to-tl from-info/5 via-transparent to-transparent blur-3xl" style={{ animation: 'float 25s ease-in-out infinite -5s' }} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-16 h-16 rounded-2xl gradient-primary mx-auto mb-4 flex items-center justify-center glow-primary"
          >
            <Search className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-semibold text-foreground">Org Explorer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            GitHub Organization Analytics Dashboard
          </p>
        </div>

        {/* Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-surface-card border border-border rounded-2xl p-6 shadow-[0_20px_60px_hsl(0_0%_0%/0.3)] card-hover backdrop-blur-sm"
        >
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={!isMultiMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsMultiMode(false)}
              className="flex-1"
            >
              Single Org
            </Button>
            <Button
              variant={isMultiMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsMultiMode(true)}
              className="flex-1"
            >
              Multi Org
            </Button>
          </div>

          {isMultiMode ? (
            <>
              {/* Multi-Org Input */}
              <div className="space-y-2 mb-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Add Organizations
                </label>
                <div className="flex gap-2">
                  <Input
                    value={org}
                    onChange={e => setOrg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOrg()}
                    placeholder="e.g. AOSSIE-Org"
                    className="bg-surface-page border-border focus:border-primary flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddOrg}
                    disabled={!org || loading}
                    className="px-3"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Orgs List */}
              {orgs.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Added organizations ({orgs.length})</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {orgs.map(o => (
                      <motion.div
                        key={o}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between bg-surface-page p-2 rounded border border-border/50 text-sm"
                      >
                        <span className="font-medium text-foreground">{o}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveOrg(o)}
                          className="h-5 px-1.5 text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Single Org Input */}
              <div className="space-y-2 mb-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Organization Name
                </label>
                <Input
                  value={org}
                  onChange={e => { setOrg(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleExplore()}
                  placeholder="e.g. AOSSIE-Org"
                  className="bg-surface-page border-border focus:border-primary"
                />
              </div>
            </>
          )}

          {/* PAT Section */}
          <div className="mb-4">
            <button
              onClick={() => setShowPat(!showPat)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Key className="w-3 h-3" />
              <span>Personal Access Token (Optional)</span>
              {showPat ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </button>
            
            {showPat && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-3 space-y-3"
              >
                <Input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="ghp_xxxx..."
                  className="bg-surface-page border-border focus:border-primary font-mono text-xs"
                />
                
                {/* Rate limit comparison */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-surface-page rounded-lg p-3 border border-border">
                    <p className="text-destructive font-medium mb-1">Without PAT</p>
                    <p className="text-muted-foreground">60 requests/hour</p>
                    <p className="text-muted-foreground">Limited data</p>
                  </div>
                  <div className="bg-surface-page rounded-lg p-3 border border-primary/30">
                    <p className="text-success font-medium mb-1">With PAT</p>
                    <p className="text-muted-foreground">5,000 requests/hour</p>
                    <p className="text-muted-foreground">Full analytics</p>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1"><Shield className="w-3 h-3" /> Required scopes: <span className="font-mono">public_repo, read:org</span></p>
                  <p className="flex items-center gap-1"><Eye className="w-3 h-3" /> Token stored locally, sent only to api.github.com</p>
                </div>
              </motion.div>
            )}
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-destructive mb-3 bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20"
            >
              {error}
            </motion.p>
          )}

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handleExplore}
              disabled={(isMultiMode ? orgs.length === 0 : !org) || loading}
              className="w-full gradient-primary text-primary-foreground hover:shadow-[0_0_30px_hsl(263_70%_66%/0.4)] transition-all gap-2 font-semibold glow-primary"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {isMultiMode ? 'Explore Multiple Orgs' : 'Explore Organization'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </motion.div>
        </motion.div>

        {/* Features */}
        <motion.div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: Zap, label: 'Zero Backend' },
            { icon: Shield, label: 'Privacy First' },
            { icon: Eye, label: 'Offline Ready' },
          ].map(({ icon: Icon, label }, i) => (
            <motion.div 
              key={label} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="text-xs text-muted-foreground flex flex-col items-center gap-1.5 p-3 rounded-lg bg-surface-card/50 border border-border hover:border-primary/30 transition-colors"
            >
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-medium">{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
