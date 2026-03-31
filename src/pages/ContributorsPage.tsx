import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ExternalLink, X, GitPullRequest, AlertCircle, GitCommit, Activity, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { githubFetch, type GHEvent } from '@/lib/github-client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

type SortKey = 'contributions' | 'login';

interface ContributorDetail {
  events: GHEvent[];
  loading: boolean;
  repoBreakdown: { repo: string; contributions: number }[];
}

const CHART_COLORS = [
  'hsl(263, 70%, 66%)', 'hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)', 'hsl(340, 82%, 52%)', 'hsl(180, 70%, 50%)',
];

const chartTooltipStyle = {
  contentStyle: {
    background: 'hsl(235, 20%, 8%)',
    border: '1px solid hsl(235, 15%, 18%)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(220, 20%, 92%)',
  },
};

export default function ContributorsPage() {
  const { org, allContributors, contributors, orgName, pat, isLoading, loadOrg } = useAppStore();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('contributions');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContributorDetail | null>(null);

  const filtered = useMemo(() => {
    let result = allContributors.filter(c =>
      c.login.toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy === 'login') result.sort((a, b) => a.login.localeCompare(b.login));
    else result.sort((a, b) => b.contributions - a.contributions);
    return result;
  }, [allContributors, search, sortBy]);

  const repoBreakdown = useMemo(() => {
    if (!selectedUser) return [];
    const breakdown: { repo: string; contributions: number }[] = [];
    contributors.forEach((contribs, repoName) => {
      const match = contribs.find(c => c.login === selectedUser);
      if (match) breakdown.push({ repo: repoName, contributions: match.contributions });
    });
    return breakdown.sort((a, b) => b.contributions - a.contributions);
  }, [selectedUser, contributors]);

  useEffect(() => {
    if (!selectedUser) { setDetail(null); return; }
    setDetail({ events: [], loading: true, repoBreakdown });
    (async () => {
      try {
        const events = await githubFetch<GHEvent[]>(`/users/${selectedUser}/events?per_page=100`, pat || undefined);
        const orgEvents = events.filter(e => e.repo.name.startsWith(`${orgName}/`));
        setDetail({ events: orgEvents, loading: false, repoBreakdown });
      } catch {
        setDetail({ events: [], loading: false, repoBreakdown });
      }
    })();
  }, [selectedUser, orgName, pat, repoBreakdown]);

  const selectedContributor = allContributors.find(c => c.login === selectedUser);

  const activityStats = useMemo(() => {
    if (!detail?.events.length) return null;
    return {
      pushes: detail.events.filter(e => e.type === 'PushEvent').length,
      prs: detail.events.filter(e => e.type === 'PullRequestEvent').length,
      issues: detail.events.filter(e => e.type === 'IssuesEvent').length,
      reviews: detail.events.filter(e => e.type === 'PullRequestReviewEvent').length,
      comments: detail.events.filter(e => e.type === 'IssueCommentEvent' || e.type === 'CommitCommentEvent').length,
      creates: detail.events.filter(e => e.type === 'CreateEvent').length,
    };
  }, [detail?.events]);

  const activityChartData = useMemo(() => {
    if (!activityStats) return [];
    return [
      { name: 'Pushes', value: activityStats.pushes },
      { name: 'PRs', value: activityStats.prs },
      { name: 'Issues', value: activityStats.issues },
      { name: 'Reviews', value: activityStats.reviews },
      { name: 'Comments', value: activityStats.comments },
      { name: 'Creates', value: activityStats.creates },
    ].filter(d => d.value > 0);
  }, [activityStats]);

  // Load org data if not loaded yet
  useEffect(() => {
    if (!org || org.login !== orgName) {
      loadOrg(orgName);
    }
  }, [org, orgName, loadOrg]);

  // Show loading skeleton while fetching data
  if (isLoading) {
    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="animate-pulse">
          <div className="h-6 w-48 shimmer rounded mb-2" />
          <div className="h-4 w-64 shimmer rounded" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-card border border-border rounded-xl p-3 animate-pulse">
          <div className="h-10 w-full shimmer rounded" />
        </motion.div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface-card border border-border rounded-lg p-3 sm:p-4 animate-pulse">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full shimmer flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-32 shimmer rounded mb-2" />
                  <div className="h-3 w-40 shimmer rounded" />
                </div>
                <div className="h-6 w-12 shimmer rounded flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h2 className="text-lg font-semibold text-foreground">Contributor Impact Directory</h2>
        <p className="text-sm text-muted-foreground">{allContributors.length} contributors across the organization</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex gap-3 items-center bg-surface-card border border-border rounded-xl p-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contributors..." className="pl-9 bg-surface-page border-border text-sm" />
        </div>
        <div className="flex gap-1 text-xs">
          <button
            className={`px-3 py-1.5 rounded-lg transition-colors ${sortBy === 'contributions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            onClick={() => setSortBy('contributions')}
          >Impact</button>
          <button
            className={`px-3 py-1.5 rounded-lg transition-colors ${sortBy === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            onClick={() => setSortBy('login')}
          >Name</button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((c, i) => (
          <motion.div
            key={c.login}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5) }}
            whileHover={{ y: -3, scale: 1.02 }}
            onClick={() => setSelectedUser(c.login)}
            className="bg-surface-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-[0_0_15px_hsl(263_70%_66%/0.06)] transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full ring-2 ring-transparent group-hover:ring-primary/30 transition-all" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{c.login}</p>
                <p className="text-xs text-muted-foreground font-mono">{c.contributions.toLocaleString()} contributions</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">No contributors found</div>
      )}

      <AnimatePresence>
        {selectedUser && selectedContributor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-surface-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <img src={selectedContributor.avatar_url} alt="" className="w-14 h-14 rounded-full ring-2 ring-primary/30" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedContributor.login}</h3>
                    <p className="text-sm text-muted-foreground">{selectedContributor.contributions.toLocaleString()} total contributions</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={selectedContributor.html_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {detail?.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {activityStats && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { label: 'Pushes', value: activityStats.pushes, icon: GitCommit },
                        { label: 'PRs', value: activityStats.prs, icon: GitPullRequest },
                        { label: 'Issues', value: activityStats.issues, icon: AlertCircle },
                        { label: 'Reviews', value: activityStats.reviews, icon: Activity },
                        { label: 'Comments', value: activityStats.comments, icon: Activity },
                        { label: 'Creates', value: activityStats.creates, icon: Activity },
                      ].map(s => (
                        <div key={s.label} className="bg-surface-page rounded-lg p-3 text-center">
                          <s.icon className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                          <p className="text-lg font-bold text-foreground font-mono">{s.value}</p>
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {repoBreakdown.length > 0 && (
                      <div className="bg-surface-page rounded-xl p-4">
                        <h4 className="text-xs font-medium text-foreground mb-3">Contributions by Repo</h4>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={repoBreakdown.slice(0, 8)} layout="vertical">
                            <XAxis type="number" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
                            <YAxis dataKey="repo" type="category" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 9 }} axisLine={false} width={80} />
                            <Tooltip {...chartTooltipStyle} />
                            <Bar dataKey="contributions" fill="hsl(263, 70%, 66%)" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {activityChartData.length > 0 && (
                      <div className="bg-surface-page rounded-xl p-4">
                        <h4 className="text-xs font-medium text-foreground mb-3">Activity Breakdown</h4>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={activityChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                              {activityChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...chartTooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {activityChartData.map((d, i) => (
                            <div key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              {d.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {detail && detail.events.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-foreground mb-2">Recent Activity in {orgName}</h4>
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {detail.events.slice(0, 20).map(e => (
                          <div key={e.id} className="flex items-center gap-2 text-xs px-3 py-2 bg-surface-page rounded-lg hover:bg-accent/40 transition-colors">
                            <span className="text-primary font-medium">{e.type.replace('Event', '')}</span>
                            <span className="text-foreground truncate flex-1">{e.repo.name.split('/')[1]}</span>
                            <span className="text-muted-foreground text-[10px]">{new Date(e.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail && detail.events.length === 0 && !detail.loading && (
                    <p className="text-xs text-muted-foreground text-center py-4">No recent public activity data available</p>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
