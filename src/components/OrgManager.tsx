import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, X, Settings, Check } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { useToast } from '../hooks/use-toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function OrgManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orgs, selectedOrgs, mode, orgName, orgsData, addOrg, removeOrg, setOrgName, setSelectedOrgs, setMode, loadOrg, loadMultipleOrgs } = useAppStore();
  const [newOrgInput, setNewOrgInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Auto-redirect when multi-org becomes empty
  useEffect(() => {
    if (mode === 'multi' && selectedOrgs.length === 0 && orgs.length > 0) {
      toast({
        title: 'No organizations selected',
        description: 'Please select at least one organization to continue.',
        variant: 'default',
      });
      navigate('/');
    }
  }, [mode, selectedOrgs.length, orgs.length, navigate, toast]);

  const handleAddOrg = async () => {
    if (!newOrgInput.trim()) return;
    
    const trimmedOrg = newOrgInput.trim();
    
    // Check for duplicates in multi mode
    if (mode === 'multi' && selectedOrgs.includes(trimmedOrg)) {
      toast({
        title: 'Organization already added',
        description: `${trimmedOrg} is already in your selected organizations.`,
        variant: 'default',
      });
      return;
    }
    
    addOrg(trimmedOrg);
    setNewOrgInput('');
    
    // Auto-select the newly added org if in multi mode
    if (mode === 'multi') {
      const updated = [...selectedOrgs, trimmedOrg];
      setSelectedOrgs(updated);
      // Load data in background without blocking UI
      loadMultipleOrgs(updated).catch(() => {
        // Silently fail - UI already updated with new org
      });
    }
  };

  const handleRemoveOrg = (orgName: string) => {
    setIsRemoving(true);
    try {
      // Check if this org is selected in multi mode before removing
      const wasSelected = selectedOrgs.includes(orgName);
      
      removeOrg(orgName);
      
      // If we were in multi mode and the org was selected, reload data in background
      if (mode === 'multi' && wasSelected && selectedOrgs.length > 1) {
        // Remove the org from selected orgs
        const updated = selectedOrgs.filter(o => o !== orgName);
        setSelectedOrgs(updated);
        
        if (updated.length > 0) {
          // Load data in background without blocking UI
          loadMultipleOrgs(updated).catch(() => {
            // Silently fail - UI already updated with removal
          });
        }
      }
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle selecting a single org - instantly reload its data
  const handleSelectSingleOrg = async (newOrgName: string) => {
    setOrgName(newOrgName);
    // Load new org's data with proper error handling
    try {
      await loadOrg(newOrgName);
    } catch (err) {
      toast({
        title: 'Failed to load organization',
        description: err instanceof Error ? err.message : 'Could not fetch organization data',
        variant: 'destructive',
      });
    }
  };

  const handleToggleMode = async (newMode: 'single' | 'multi') => {
    setMode(newMode);
    
    if (newMode === 'multi') {
      // Auto-add current single org if nothing selected yet
      let orgsToLoad = selectedOrgs;
      if (orgsToLoad.length === 0) {
        // Prioritize: current orgName (single mode) > first available org
        if (orgName && orgs.some(o => o.name === orgName)) {
          orgsToLoad = [orgName];
        } else if (orgs.length > 0) {
          orgsToLoad = [orgs[0].name];
        }
        
        if (orgsToLoad.length > 0) {
          setSelectedOrgs(orgsToLoad);
        }
      }
      
      // Check if we have cached data for >= 2 orgs
      const orgsWithCachedData = Array.from(orgsData.keys());
      const hasSufficientCachedData = orgsWithCachedData.length >= 2;
      const hasEnoughListedOrgs = orgs.length >= 2;
      
      // If we have >= 2 orgs with cached data, use them and show notification
      if (hasSufficientCachedData) {
        setSelectedOrgs(orgsWithCachedData);
        toast({
          title: 'Starting comparison',
          description: 'Loading comparison data for selected organizations...',
          variant: 'default',
        });
      } else if (hasEnoughListedOrgs) {
        // We have >= 2 orgs in the list but not all cached - show notification and start fetching
        const orgsToCompare = orgs.slice(0, 2).map(o => o.name);
        setSelectedOrgs(orgsToCompare);
        toast({
          title: 'Starting comparison',
          description: 'Fetching comparison data for organizations...',
          variant: 'default',
        });
        setIsLoading(true);
        try {
          await loadMultipleOrgs(orgsToCompare);
        } finally {
          setIsLoading(false);
        }
        return;
      } else {
        // No cached data and < 2 selected - show error notification
        toast({
          title: 'Add more organizations',
          description: 'Please add at least 2 organizations to use comparison mode.',
          variant: 'default',
        });
        return;
      }
      
      if (orgsToLoad.length > 0 && !hasSufficientCachedData) {
        setIsLoading(true);
        try {
          await loadMultipleOrgs(orgsToLoad);
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const handleOrgSelect = (orgName: string, isSelected: boolean) => {
    const updated = isSelected
      ? [...selectedOrgs, orgName]
      : selectedOrgs.filter(o => o !== orgName);
    
    setSelectedOrgs(updated);
    
    if (mode === 'multi') {
      // Check if we have cached data for >= 2 orgs
      const orgsWithCachedData = Array.from(orgsData.keys());
      const hasSufficientCachedData = orgsWithCachedData.length >= 2;
      
      if (updated.length < 2 && !hasSufficientCachedData) {
        // Less than 2 selected AND no cached data - show notification
        if (updated.length === 1) {
          toast({
            title: 'Select another organization',
            description: 'You need at least 2 organizations to use comparison mode.',
            variant: 'default',
          });
        }
      } else if (updated.length >= 2) {
        // 2+ orgs selected, load data in background without blocking UI
        loadMultipleOrgs(updated).catch(() => {
          // Silently fail - UI already updated
        });
      }
      // If < 2 selected but have sufficient cached data, don't load - just update state
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 p-4 rounded-lg border border-border bg-surface-card"
    >
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Mode</h3>
          <p className="text-xs text-muted-foreground">Single or Multi-org view</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'single' ? 'default' : 'outline'}
            onClick={() => handleToggleMode('single')}
            className="text-xs"
          >
            Single
          </Button>
          <Button
            size="sm"
            variant={mode === 'multi' ? 'default' : 'outline'}
            onClick={() => handleToggleMode('multi')}
            className="text-xs"
          >
            Multi
          </Button>
        </div>
      </div>

      {/* Add Org */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Add Organization</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., AOSSIE-Org"
            value={newOrgInput}
            onChange={(e) => setNewOrgInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddOrg()}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={handleAddOrg}
            disabled={!newOrgInput.trim()}
            className="px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Saved Orgs */}
      {orgs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Saved Organizations</h3>
            {mode === 'multi' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-6 px-2">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Select Organizations</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {orgs.map((org) => (
                    <DropdownMenuCheckboxItem
                      key={org.name}
                      checked={selectedOrgs.includes(org.name)}
                      onCheckedChange={(checked) => handleOrgSelect(org.name, checked)}
                    >
                      {org.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {orgs.map((org) => (
              <motion.div
                key={org.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer ${
                  mode === 'single' && orgName === org.name
                    ? 'bg-primary/10 border-primary hover:bg-primary/20'
                    : 'bg-surface-secondary border-border/50 hover:border-border'
                }`}
                onClick={() => mode === 'single' && handleSelectSingleOrg(org.name)}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{org.name}</p>
                  {mode === 'multi' && (
                    <p className="text-xs text-muted-foreground">
                      {selectedOrgs.includes(org.name) ? 'Selected' : 'Unselected'}
                    </p>
                  )}
                  {mode === 'single' && orgName === org.name && (
                    <p className="text-xs text-primary font-semibold">Current Org</p>
                  )}
                </div>
                {mode === 'single' && orgName === org.name ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveOrg(org.name);
                    }}
                    disabled={isRemoving}
                    className="h-6 px-2 text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </motion.div>
            ))}
          </div>

          {mode === 'multi' && selectedOrgs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing data from {selectedOrgs.length} organization{selectedOrgs.length !== 1 ? 's' : ''}
            </p>
          )}
          {mode === 'single' && orgName && (
            <p className="text-xs text-muted-foreground">
              Currently viewing: <span className="font-semibold text-foreground">{orgName}</span>
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
