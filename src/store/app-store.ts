import { create } from 'zustand';
import type { GHOrg, GHRepo, GHContributor, GHEvent } from '@/lib/github-client';
import { githubFetch, githubPaginateAll, getRateLimitInfo } from '@/lib/github-client';
import type { HealthScore } from '@/lib/health-score';
import { calculateHealthScore } from '@/lib/health-score';

interface AppState {
  // Auth
  pat: string;
  setPat: (pat: string) => void;
  
  // Multi-org support
  orgs: Array<{ name: string; org: GHOrg | null }>;
  selectedOrgs: string[];
  mode: 'single' | 'multi';
  setMode: (mode: 'single' | 'multi') => void;
  addOrg: (orgName: string) => void;
  removeOrg: (orgName: string) => void;
  setSelectedOrgs: (orgs: string[]) => void;
  
  // Current view (single org for backward compat)
  orgName: string;
  setOrgName: (name: string) => void;
  org: GHOrg | null;
  
  // Aggregated data
  repos: GHRepo[];
  contributors: Map<string, GHContributor[]>;
  allContributors: GHContributor[];
  events: GHEvent[];
  healthScores: Map<number, HealthScore>;
  languages: Map<string, number>;
  
  // Org-specific data cache
  orgsData: Map<string, {
    org: GHOrg | null;
    repos: GHRepo[];
    contributors: Map<string, GHContributor[]>;
    allContributors: GHContributor[];
    events: GHEvent[];
    languages: Map<string, number>;
    healthScores: Map<number, HealthScore>;
  }>;
  
  // UI
  isLoading: boolean;
  error: string | null;
  isSetup: boolean;
  
  // Rate limit
  rateLimit: { remaining: number; limit: number; resetAt: number };
  
  // Actions
  loadOrg: (orgToLoad?: string) => Promise<void>;
  loadMultipleOrgs: (orgNames: string[]) => Promise<void>;
  clearData: () => void;
  syncData: () => Promise<void>;
}

const safeJsonParse = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    // localStorage corrupted or invalid JSON - return fallback silently
    return fallback;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  pat: localStorage.getItem('org-explorer-pat') || '',
  orgName: localStorage.getItem('org-explorer-active-org') || '',
  orgs: safeJsonParse('org-explorer-orgs', []),
  selectedOrgs: safeJsonParse('org-explorer-selected-orgs', []),
  mode: (localStorage.getItem('org-explorer-mode') || 'single') as 'single' | 'multi',
  org: null,
  repos: [],
  contributors: new Map(),
  allContributors: [],
  events: [],
  healthScores: new Map(),
  languages: new Map(),
  orgsData: new Map(),
  isLoading: false,
  error: null,
  isSetup: !localStorage.getItem('org-explorer-active-org'),
  rateLimit: { remaining: 5000, limit: 5000, resetAt: 0 },

  setPat: (pat) => {
    localStorage.setItem('org-explorer-pat', pat);
    set({ pat });
  },

  setOrgName: (name) => {
    localStorage.setItem('org-explorer-active-org', name);
    set({ orgName: name });
  },

  setMode: (mode) => {
    localStorage.setItem('org-explorer-mode', mode);
    set({ mode });
  },

  addOrg: (orgName) => {
    const { orgs } = get();
    if (!orgs.find(o => o.name === orgName)) {
      const newOrgs = [...orgs, { name: orgName, org: null }];
      localStorage.setItem('org-explorer-orgs', JSON.stringify(newOrgs));
      set({ orgs: newOrgs });
    }
  },

  removeOrg: (orgName) => {
    const { orgs, selectedOrgs, orgsData } = get();
    const newOrgs = orgs.filter(o => o.name !== orgName);
    const newSelected = selectedOrgs.filter(o => o !== orgName);
    
    // Clean up orgsData for removed org
    const newOrgsData = new Map(orgsData);
    newOrgsData.delete(orgName);
    
    localStorage.setItem('org-explorer-orgs', JSON.stringify(newOrgs));
    localStorage.setItem('org-explorer-selected-orgs', JSON.stringify(newSelected));
    set({ orgs: newOrgs, selectedOrgs: newSelected, orgsData: newOrgsData });
  },

  setSelectedOrgs: (orgs) => {
    localStorage.setItem('org-explorer-selected-orgs', JSON.stringify(orgs));
    set({ selectedOrgs: orgs });
  },

  loadOrg: async (orgToLoad?: string) => {
    const { pat, orgName: currentOrg } = get();
    const orgName = orgToLoad || currentOrg;
    if (!orgName) return;

    // Clear old org's cache for all API endpoints
    const cacheKeysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cache:') || key.startsWith('etag:'))) {
        cacheKeysToDelete.push(key);
      }
    }
    cacheKeysToDelete.forEach(key => localStorage.removeItem(key));

    set({ isLoading: true, error: null });
    
    try {
      // Fetch org info
      const org = await githubFetch<GHOrg>(`/orgs/${orgName}`, pat || undefined);
      set({ org });

      // Fetch repos
      const repos = await githubPaginateAll<GHRepo>(`/orgs/${orgName}/repos?sort=pushed`, pat || undefined, 5);
      set({ repos });

      // Compute language aggregation
      const langMap = new Map<string, number>();
      repos.forEach(r => {
        if (r.language) {
          langMap.set(r.language, (langMap.get(r.language) || 0) + 1);
        }
      });
      set({ languages: langMap });

      // Fetch events
      try {
        const events = await githubFetch<GHEvent[]>(`/orgs/${orgName}/events?per_page=50`, pat || undefined);
        set({ events });
      } catch { /* events are optional */ }

      // Fetch contributors for top repos
      const topRepos = repos.slice(0, 20);
      const contribMap = new Map<string, GHContributor[]>();
      const allContribMap = new Map<string, GHContributor>();
      
      for (const repo of topRepos) {
        try {
          const contribs = await githubFetch<GHContributor[]>(
            `/repos/${orgName}/${repo.name}/contributors?per_page=30`,
            pat || undefined
          );
          contribMap.set(repo.name, contribs);
          contribs.forEach(c => {
            if (c.type === 'User') {
              const existing = allContribMap.get(c.login);
              if (existing) {
                existing.contributions += c.contributions;
              } else {
                allContribMap.set(c.login, { ...c });
              }
            }
          });
        } catch { /* skip */ }
      }
      
      set({ 
        contributors: contribMap, 
        allContributors: Array.from(allContribMap.values()).sort((a, b) => b.contributions - a.contributions),
      });

      // Compute health scores
      const scores = new Map<number, HealthScore>();
      repos.forEach(r => {
        scores.set(r.id, calculateHealthScore(r));
      });
      set({ healthScores: scores });

      set({ isSetup: false, rateLimit: getRateLimitInfo() });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadMultipleOrgs: async (orgNames: string[]) => {
    const { pat } = get();
    set({ isLoading: true, error: null });

    try {
      const orgsData = new Map<string, any>();
      const orgsWithData: Array<{ name: string; org: GHOrg | null }> = [];

      // Fetch data for EACH org separately (no combining)
      for (const orgName of orgNames) {
        try {
          const org = await githubFetch<GHOrg>(`/orgs/${orgName}`, pat || undefined);
          orgsWithData.push({ name: orgName, org });

          // Fetch repos for this org
          const repos = await githubPaginateAll<GHRepo>(`/orgs/${orgName}/repos?sort=pushed`, pat || undefined, 5);

          // Compute languages for this org only
          const langMap = new Map<string, number>();
          repos.forEach(r => {
            if (r.language) {
              langMap.set(r.language, (langMap.get(r.language) || 0) + 1);
            }
          });

          // Fetch events for this org
          let events: GHEvent[] = [];
          try {
            events = await githubFetch<GHEvent[]>(`/orgs/${orgName}/events?per_page=50`, pat || undefined);
          } catch { /* skip */ }

          // Fetch contributors for top repos of this org
          const topRepos = repos.slice(0, 20);
          const contribMap = new Map<string, GHContributor[]>();
          const allContribMap = new Map<string, GHContributor>();

          for (const repo of topRepos) {
            try {
              const contribs = await githubFetch<GHContributor[]>(
                `/repos/${orgName}/${repo.name}/contributors?per_page=30`,
                pat || undefined
              );
              contribMap.set(repo.name, contribs);
              contribs.forEach(c => {
                if (c.type === 'User') {
                  const existing = allContribMap.get(c.login);
                  if (existing) {
                    existing.contributions += c.contributions;
                  } else {
                    allContribMap.set(c.login, { ...c });
                  }
                }
              });
            } catch { /* skip */ }
          }

          // Compute health scores for this org's repos
          const scores = new Map<number, HealthScore>();
          repos.forEach(r => {
            scores.set(r.id, calculateHealthScore(r));
          });

          // Store this org's data separately
          orgsData.set(orgName, {
            org,
            repos,
            contributors: contribMap,
            allContributors: Array.from(allContribMap.values()).sort((a, b) => b.contributions - a.contributions),
            events,
            languages: langMap,
            healthScores: scores,
          });
        } catch (err) {
          // Silently skip failed org - continue loading other orgs
          // Error is already set in store from main try-catch
        }
      }

      set({
        orgs: orgsWithData,
        repos: [], // Empty - users view comparison page instead
        events: [],
        languages: new Map(),
        healthScores: new Map(),
        contributors: new Map(),
        allContributors: [],
        orgsData,
        isSetup: false,
        rateLimit: getRateLimitInfo(),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearData: () => {
    localStorage.removeItem('org-explorer-pat');
    localStorage.removeItem('org-explorer-active-org');
    localStorage.removeItem('org-explorer-orgs');
    localStorage.removeItem('org-explorer-selected-orgs');
    localStorage.removeItem('org-explorer-mode');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('etag:') || key.startsWith('cache:')) {
        localStorage.removeItem(key);
      }
    });
    set({
      pat: '', orgName: '', org: null, repos: [], contributors: new Map(),
      allContributors: [], events: [], healthScores: new Map(), languages: new Map(),
      orgs: [], selectedOrgs: [], mode: 'single', orgsData: new Map(),
      isSetup: true, error: null,
    });
  },

  syncData: async () => {
    const { mode, selectedOrgs, orgName } = get();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('etag:')) localStorage.removeItem(key);
    });
    
    if (mode === 'multi' && selectedOrgs.length > 0) {
      await get().loadMultipleOrgs(selectedOrgs);
    } else {
      await get().loadOrg(orgName);
    }
  },
}));
