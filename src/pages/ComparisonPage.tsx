import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitFork, Users, Star, AlertCircle, Activity, TrendingUp, GitPullRequest, Heart, AlertTriangle, Scale, Shield, Clock, Zap, GitCommit, Gift, Tag } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import SkeletonCard from '@/components/shared/SkeletonCard';
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import type { GHEvent } from '@/lib/github-client';

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Scala: '#c22d40',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Dart: '#00B4AB',
  R: '#198CE7', Jupyter: '#DA5B0B', Vue: '#41b883',
};

const PIE_COLORS = [
  'hsl(263, 70%, 66%)', 'hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)', 'hsl(340, 82%, 52%)', 'hsl(180, 70%, 50%)',
  'hsl(25, 95%, 53%)', 'hsl(280, 65%, 60%)',
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

export default function ComparisonPage() {
  const { selectedOrgs, mode, orgsData, isLoading, isSetup } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSetup) navigate('/');
    else if (mode !== 'multi' || selectedOrgs.length === 0) navigate('/dashboard');
  }, [isSetup, mode, selectedOrgs, navigate]);

  const comparisonOrgs = selectedOrgs
    .map(orgName => ({
      name: orgName,
      data: orgsData.get(orgName),
    }))
    .filter(org => org.data);

  // Analytics for each org
  const orgAnalytics = useMemo(() => {
    return comparisonOrgs.map(org => {
      const repos = org.data?.repos || [];
      const events = org.data?.events || [];
      const allContributors = org.data?.allContributors || [];
      const healthScores = org.data?.healthScores || new Map();

      const now = Date.now();
      const d30 = 30 * 24 * 60 * 60 * 1000;

      // Health
      const repoHealth = (() => {
        const buckets = { Excellent: 0, Good: 0, Fair: 0, 'Needs Attention': 0, Stale: 0 };
        healthScores.forEach((hs: any) => {
          if (hs.total >= 80) buckets.Excellent++;
          else if (hs.total >= 60) buckets.Good++;
          else if (hs.total >= 40) buckets.Fair++;
          else if (hs.total >= 20) buckets['Needs Attention']++;
          else buckets.Stale++;
        });
        return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
      })();

      // Large repos (50MB+)
      const largeRepos = repos.filter(r => r.size > 50000).sort((a, b) => b.size - a.size);

      // Stale repos
      const staleRepos = repos.filter(r => (now - new Date(r.pushed_at).getTime()) > d30);

      // License
      const licenseData = (() => {
        const licMap = new Map<string, number>();
        repos.forEach(r => {
          const lic = r.license?.name || 'No License';
          licMap.set(lic, (licMap.get(lic) || 0) + 1);
        });
        return Array.from(licMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value }));
      })();

      // Activity timeline
      const activityTimeline = (() => {
        const monthMap = new Map<string, number>();
        repos.forEach(r => {
          const d = new Date(r.pushed_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthMap.set(key, (monthMap.get(key) || 0) + 1);
        });
        return Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
          .map(([month, count]) => ({ month, repos: count }));
      })();

      // Event breakdown
      const eventTypeData = (() => {
        const typeMap = new Map<string, number>();
        events.forEach(e => {
          const type = e.type.replace('Event', '');
          typeMap.set(type, (typeMap.get(type) || 0) + 1);
        });
        return Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([name, value]) => ({ name, value }));
      })();

      // CI/CD health & metrics
      const cicdMetrics = (() => {
        const prEvents = events.filter(e => e.type === 'PullRequestEvent');
        const issueEvents = events.filter(e => e.type === 'IssuesEvent');
        const pushEvents = events.filter(e => e.type === 'PushEvent');
        
        const totalIssues = repos.reduce((s, r) => s + r.open_issues_count, 0);
        const prRate = prEvents.length > 0 ? Math.round((prEvents.length / (prEvents.length + issueEvents.length + pushEvents.length)) * 100) : 0;
        const issueRate = issueEvents.length > 0 ? Math.round((issueEvents.length / (prEvents.length + issueEvents.length + pushEvents.length)) * 100) : 0;
        const mergeRate = Math.round((prEvents.length / Math.max(1, repos.length)) * 10) / 10;
        const issueCreatedPerWeek = Math.round((issueEvents.length / 4) * 10) / 10;
        const prPerWeek = Math.round((prEvents.length / 4) * 10) / 10;

        return {
          totalPRs: prEvents.length,
          totalIssues: issueEvents.length,
          totalPushes: pushEvents.length,
          prPercentage: prRate,
          issuePercentage: issueRate,
          mergeRate,
          issueCreatedPerWeek,
          prPerWeek,
          openIssuesTotal: totalIssues,
        };
      })();

      // Bus factor
      const busFactor = (() => {
        if (allContributors.length === 0) return 0;
        const total = allContributors.reduce((s, c) => s + c.contributions, 0);
        let sum = 0;
        let count = 0;
        for (const c of allContributors) {
          sum += c.contributions;
          count++;
          if (sum >= total * 0.8) break;
        }
        return count;
      })();

      return {
        orgName: org.name,
        repos,
        events,
        allContributors,
        repoHealth,
        largeRepos,
        staleRepos,
        licenseData,
        activityTimeline,
        eventTypeData,
        cicdMetrics,
        busFactor,
      };
    });
  }, [comparisonOrgs]);

  const MetricCard = ({
    label,
    icon,
    getValue,
  }: {
    label: string;
    icon: React.ReactNode;
    getValue: (data: any) => number | string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-card border border-border rounded-lg p-4 hover:border-primary/30 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="text-primary">{icon}</div>
        <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
      </div>
      <div className="space-y-2">
        {comparisonOrgs.map((org) => (
          <div key={org.name} className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{org.name}</span>
            <span className="text-sm font-semibold text-foreground">
              {getValue(org.data)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-lg font-semibold text-foreground">Organization Comparison</h2>
        <p className="text-sm text-muted-foreground">
          Complete side-by-side analytics for {selectedOrgs.length} organization{selectedOrgs.length !== 1 ? 's' : ''}
        </p>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : comparisonOrgs.length > 0 ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Repositories"
              icon={<GitFork className="w-4 h-4" />}
              getValue={(data) => data.repos?.length || 0}
            />
            <MetricCard
              label="Contributors"
              icon={<Users className="w-4 h-4" />}
              getValue={(data) => data.allContributors?.length || 0}
            />
            <MetricCard
              label="Total Stars"
              icon={<Star className="w-4 h-4" />}
              getValue={(data) =>
                data.repos?.reduce((sum: number, r: any) => sum + (r.stargazers_count || 0), 0) || 0
              }
            />
            <MetricCard
              label="Open Issues"
              icon={<AlertCircle className="w-4 h-4" />}
              getValue={(data) =>
                data.repos?.reduce((sum: number, r: any) => sum + (r.open_issues_count || 0), 0) || 0
              }
            />
          </div>

          {/* Health Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {orgAnalytics.map((analytics) => (
              <div
                key={analytics.orgName}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" />
                  Repository Health - {analytics.orgName}
                </h3>
                {analytics.repoHealth.length > 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.repoHealth}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analytics.repoHealth.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...chartTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No health data</p>
                )}
                <div className="mt-4 space-y-1 text-xs">
                  {analytics.repoHealth.map((item) => (
                    <div key={item.name} className="flex justify-between">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Languages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {comparisonOrgs.map((org) => {
              const langData = Array.from(org.data?.languages?.entries() || [])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, value]) => ({ name, value }));

              return (
                <div
                  key={org.name}
                  className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
                >
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Languages - {org.name}
                  </h3>
                  {langData.length > 0 ? (
                    <div className="flex items-center gap-6">
                      <div className="w-40 h-40 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={langData}
                              cx="50%"
                              cy="50%"
                              innerRadius={35}
                              outerRadius={65}
                              paddingAngle={2}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {langData.map((entry) => (
                                <Cell key={entry.name} fill={LANG_COLORS[entry.name] || '#8b5cf6'} />
                              ))}
                            </Pie>
                            <Tooltip {...chartTooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2 text-xs max-h-40 overflow-y-auto">
                        {langData.map(({ name, value }) => (
                          <div key={name} className="flex justify-between items-center">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-semibold text-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">No language data</p>
                  )}
                </div>
              );
            })}
          </motion.div>

          {/* License Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {orgAnalytics.map((analytics) => (
              <div
                key={analytics.orgName}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" />
                  License Distribution - {analytics.orgName}
                </h3>
                {analytics.licenseData.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {analytics.licenseData.map((item) => (
                      <div key={item.name} className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                        <span className="text-muted-foreground truncate">{item.name}</span>
                        <span className="font-semibold text-foreground ml-2">{item.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No license data</p>
                )}
              </div>
            ))}
          </motion.div>

          {/* Large Repos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {orgAnalytics.map((analytics) => (
              <div
                key={analytics.orgName}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  Large Repos (50MB+) - {analytics.orgName}
                </h3>
                {analytics.largeRepos.length > 0 ? (
                  <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                    {analytics.largeRepos.map((repo: any) => (
                      <div key={repo.name} className="p-2 rounded bg-surface-page/50 border border-border/30">
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground truncate flex-1">{repo.name}</span>
                          <span className="font-semibold text-primary ml-2">{Math.round(repo.size / 1024)}MB</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No large repos</p>
                )}
              </div>
            ))}
          </motion.div>

          {/* Stale Repos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {orgAnalytics.map((analytics) => (
              <div
                key={analytics.orgName}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Stale Repos (30+ days) - {analytics.orgName}
                </h3>
                <div className="text-sm font-semibold text-foreground mb-3">
                  {analytics.staleRepos.length} repo{analytics.staleRepos.length !== 1 ? 's' : ''}
                </div>
                {analytics.staleRepos.length > 0 ? (
                  <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                    {analytics.staleRepos.slice(0, 10).map((repo: any) => (
                      <div key={repo.name} className="p-2 rounded bg-surface-page/50 border border-border/30">
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground truncate flex-1">{repo.name}</span>
                          <span className="text-warning text-[10px] ml-2">
                            {formatDistanceToNow(new Date(repo.pushed_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No stale repos</p>
                )}
              </div>
            ))}
          </motion.div>

          {/* Activity Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {orgAnalytics.map((analytics) => (
              <div
                key={analytics.orgName}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Activity Timeline - {analytics.orgName}
                </h3>
                {analytics.activityTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analytics.activityTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 18%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Line type="monotone" dataKey="repos" stroke="hsl(263, 70%, 66%)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No activity data</p>
                )}
              </div>
            ))}
          </motion.div>

          {/* Event Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {orgAnalytics.map((analytics) => (
              <div
                key={analytics.orgName}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-primary" />
                  Event Type Breakdown - {analytics.orgName}
                </h3>
                {analytics.eventTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.eventTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 18%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="value" fill="hsl(263, 70%, 66%)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No event data</p>
                )}
              </div>
            ))}
          </motion.div>

          {/* CI/CD Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {orgAnalytics.map((analytics) => (
              <div
                key={analytics.orgName}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  CI/CD & Development Metrics - {analytics.orgName}
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Total PRs</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.totalPRs}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">PR per Week</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.prPerWeek}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Merge Rate</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.mergeRate}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Total Issues</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.totalIssues}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Issues per Week</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.issueCreatedPerWeek}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Open Issues</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.openIssuesTotal}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Total Pushes</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.totalPushes}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">PR %</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.prPercentage}%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Issue %</span>
                    <span className="font-semibold text-foreground">{analytics.cicdMetrics.issuePercentage}%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-surface-page/50 border border-border/30">
                    <span className="text-muted-foreground">Bus Factor</span>
                    <span className={`font-semibold ${analytics.busFactor <= 2 ? 'text-destructive' : 'text-foreground'}`}>
                      {analytics.busFactor} person{analytics.busFactor !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Recent Events */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {comparisonOrgs.map((org) => (
              <div
                key={org.name}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Recent Events - {org.name}
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {org.data?.events?.slice(0, 10).map((event: GHEvent, idx: number) => (
                    <motion.div
                      key={`${event.id}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-2 rounded bg-surface-page/50 border border-border/30 hover:border-primary/30 transition-colors text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-foreground mt-0.5 text-primary">
                          {event.type === 'PushEvent' && <GitCommit className="w-4 h-4" />}
                          {event.type === 'PullRequestEvent' && <GitPullRequest className="w-4 h-4" />}
                          {event.type === 'IssuesEvent' && <AlertCircle className="w-4 h-4" />}
                          {event.type === 'ReleaseEvent' && <Gift className="w-4 h-4" />}
                          {!['PushEvent', 'PullRequestEvent', 'IssuesEvent', 'ReleaseEvent'].includes(event.type) && <Tag className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-muted-foreground truncate">
                            {event.actor.login}
                          </p>
                          <p className="text-foreground font-medium truncate">
                            {event.repo.name}
                          </p>
                          <p className="text-muted-foreground text-[10px]">
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {(!org.data?.events || org.data.events.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-4">No recent events</p>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No organizations to compare</p>
        </div>
      )}
    </div>
  );
}
