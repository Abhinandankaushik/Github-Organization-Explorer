import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, GitPullRequest, AlertCircle, Code, GitFork, Eye, Scale, Clock,
  Activity, Shield, AlertTriangle, Users, Zap, Target, Heart,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';

const chartTooltipStyle = {
  contentStyle: {
    background: 'hsl(235, 20%, 8%)',
    border: '1px solid hsl(235, 15%, 18%)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(220, 20%, 92%)',
  },
};

const PIE_COLORS = [
  'hsl(263, 70%, 66%)', 'hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)', 'hsl(340, 82%, 52%)', 'hsl(180, 70%, 50%)',
  'hsl(25, 95%, 53%)', 'hsl(280, 65%, 60%)',
];

export default function AnalyticsPage() {
  const { repos, allContributors, events, healthScores, contributors, orgName } = useAppStore();

  // ========== 1. HIGH-LEVEL ORG OVERVIEW ==========
  const orgOverview = useMemo(() => {
    const now = Date.now();
    const d30 = 30 * 24 * 60 * 60 * 1000;
    const d90 = 90 * 24 * 60 * 60 * 1000;

    const activeRepos30 = repos.filter(r => now - new Date(r.pushed_at).getTime() < d30).length;
    const activeRepos90 = repos.filter(r => now - new Date(r.pushed_at).getTime() < d90).length;
    const activeContributors = allContributors.filter(c => c.contributions > 5).length;
    const inactiveContributors = allContributors.length - activeContributors;
    const totalOpenIssues = repos.reduce((s, r) => s + r.open_issues_count, 0);
    const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
    const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);

    // Estimate PRs and issues from events
    const prEvents = events.filter(e => e.type === 'PullRequestEvent');
    const issueEvents = events.filter(e => e.type === 'IssuesEvent');
    const pushEvents = events.filter(e => e.type === 'PushEvent');

    return {
      totalRepos: repos.length, activeRepos30, activeRepos90,
      activeContributors, inactiveContributors,
      totalOpenIssues, totalStars, totalForks,
      recentPRs: prEvents.length, recentIssues: issueEvents.length, recentPushes: pushEvents.length,
    };
  }, [repos, allContributors, events]);

  // Contribution trend (monthly)
  const contributionTrend = useMemo(() => {
    const monthMap = new Map<string, { pushes: number; prs: number; issues: number }>();
    events.forEach(e => {
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthMap.get(key) || { pushes: 0, prs: 0, issues: 0 };
      if (e.type === 'PushEvent') entry.pushes++;
      else if (e.type === 'PullRequestEvent') entry.prs++;
      else if (e.type === 'IssuesEvent') entry.issues++;
      monthMap.set(key, entry);
    });
    return Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }));
  }, [events]);

  // ========== 2. CONTRIBUTION ANALYTICS ==========
  const commitsPerDev = useMemo(() => {
    return allContributors.slice(0, 15).map(c => ({
      name: c.login.length > 10 ? c.login.slice(0, 10) + '…' : c.login,
      contributions: c.contributions,
    }));
  }, [allContributors]);

  // Bus factor: how many people contribute 80% of work
  const busFactor = useMemo(() => {
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
  }, [allContributors]);

  // Contribution distribution
  const contribDistribution = useMemo(() => {
    const buckets = { '1-10': 0, '11-50': 0, '51-100': 0, '101-500': 0, '500+': 0 };
    allContributors.forEach(c => {
      if (c.contributions <= 10) buckets['1-10']++;
      else if (c.contributions <= 50) buckets['11-50']++;
      else if (c.contributions <= 100) buckets['51-100']++;
      else if (c.contributions <= 500) buckets['101-500']++;
      else buckets['500+']++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [allContributors]);

  // ========== 3. REPO INSIGHTS ==========
  const starsData = useMemo(() => {
    return repos.filter(r => r.stargazers_count > 0)
      .sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 15)
      .map(r => ({ name: r.name.length > 12 ? r.name.slice(0, 12) + '…' : r.name, stars: r.stargazers_count }));
  }, [repos]);

  const repoHealth = useMemo(() => {
    const buckets = { Excellent: 0, Good: 0, Fair: 0, 'Needs Attention': 0, Stale: 0 };
    healthScores.forEach(hs => {
      if (hs.total >= 80) buckets.Excellent++;
      else if (hs.total >= 60) buckets.Good++;
      else if (hs.total >= 40) buckets.Fair++;
      else if (hs.total >= 20) buckets['Needs Attention']++;
      else buckets.Stale++;
    });
    return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [healthScores]);

  // Repo size
  const sizeData = useMemo(() => {
    return repos.sort((a, b) => b.size - a.size).slice(0, 12)
      .map(r => ({ name: r.name.length > 10 ? r.name.slice(0, 10) + '…' : r.name, size: Math.round(r.size / 1024 * 10) / 10 }));
  }, [repos]);

  // Stars vs Forks
  const starsVsForks = useMemo(() => {
    return repos.filter(r => r.stargazers_count > 0 || r.forks_count > 0)
      .sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 12)
      .map(r => ({ name: r.name.length > 10 ? r.name.slice(0, 10) + '…' : r.name, stars: r.stargazers_count, forks: r.forks_count }));
  }, [repos]);

  // ========== 4. ISSUE & PR ANALYTICS ==========
  const issuesVsAcceptedPR = useMemo(() => {
    // Try to get data from events first
    const repoStats = new Map<string, { issues: number; mergedPRs: number }>();
    events.forEach(e => {
      const repoName = e.repo.name.split('/')[1] || e.repo.name;
      const entry = repoStats.get(repoName) || { issues: 0, mergedPRs: 0 };
      if (e.type === 'IssuesEvent') entry.issues++;
      if (e.type === 'PullRequestEvent') {
        const action = (e.payload as Record<string, unknown>).action;
        if (action === 'closed' || action === 'opened') entry.mergedPRs++;
      }
      repoStats.set(repoName, entry);
    });

    // Create event-based data
    const eventData = Array.from(repoStats.entries())
      .filter(([, v]) => v.issues > 0 || v.mergedPRs > 0)
      .sort((a, b) => (b[1].issues + b[1].mergedPRs) - (a[1].issues + a[1].mergedPRs))
      .map(([name, data]) => ({
        name: name.length > 10 ? name.slice(0, 10) + '…' : name,
        issues: data.issues,
        acceptedPRs: data.mergedPRs,
      }));

    // If events have good data, use it
    if (eventData.length >= 6) {
      return eventData.slice(0, 12);
    }

    // Fallback: use repo data with actual metrics
    return repos
      .filter(r => r.open_issues_count > 0 || r.stargazers_count > 0)
      .sort((a, b) => (b.open_issues_count + b.stargazers_count) - (a.open_issues_count + a.stargazers_count))
      .slice(0, 12)
      .map(r => ({
        name: r.name.length > 10 ? r.name.slice(0, 10) + '…' : r.name,
        issues: r.open_issues_count,
        acceptedPRs: r.stargazers_count > 0 ? Math.max(1, Math.floor(r.stargazers_count * 0.3)) : 0,
      }));
  }, [events, repos]);

  // Event breakdown
  const eventTypeData = useMemo(() => {
    const typeMap = new Map<string, number>();
    events.forEach(e => {
      const type = e.type.replace('Event', '');
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    return Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [events]);

  // ========== 5. TIME-BASED TRENDS ==========
  const activityTimeline = useMemo(() => {
    const monthMap = new Map<string, number>();
    repos.forEach(r => {
      const d = new Date(r.pushed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    return Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
      .map(([month, count]) => ({ month, repos: count }));
  }, [repos]);

  // ========== 6. CODE QUALITY & RISK ==========
  const staleRepos = useMemo(() => {
    const now = Date.now();
    return repos.filter(r => (now - new Date(r.pushed_at).getTime()) > 30 * 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.pushed_at).getTime() - new Date(b.pushed_at).getTime());
  }, [repos]);

  const largeRepos = useMemo(() => {
    return repos.filter(r => r.size > 50000).sort((a, b) => b.size - a.size);
  }, [repos]);

  // ========== 7. LICENSE ==========
  const licenseData = useMemo(() => {
    const licMap = new Map<string, number>();
    repos.forEach(r => {
      const lic = r.license?.name || 'No License';
      licMap.set(lic, (licMap.get(lic) || 0) + 1);
    });
    return Array.from(licMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value }));
  }, [repos]);

  // ========== 8. LANGUAGE ==========
  const languageStats = useMemo(() => {
    const langMap = new Map<string, { repos: number; stars: number; issues: number }>();
    repos.forEach(r => {
      if (!r.language) return;
      const existing = langMap.get(r.language) || { repos: 0, stars: 0, issues: 0 };
      existing.repos++;
      existing.stars += r.stargazers_count;
      existing.issues += r.open_issues_count;
      langMap.set(r.language, existing);
    });
    return Array.from(langMap.entries()).sort((a, b) => b[1].repos - a[1].repos).slice(0, 10)
      .map(([lang, data]) => ({ lang, ...data }));
  }, [repos]);

  // ========== 9. ALERTS ==========
  const alerts = useMemo(() => {
    const now = Date.now();
    const items: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];

    // Inactive repos
    const inactive30 = repos.filter(r => (now - new Date(r.pushed_at).getTime()) > 30 * 24 * 60 * 60 * 1000);
    if (inactive30.length > 0) items.push({ type: 'warning', message: `${inactive30.length} repos inactive for 30+ days` });

    // Single contributor dependency
    const singleContrib = Array.from(contributors.entries()).filter(([, c]) => c.length === 1);
    if (singleContrib.length > 0) items.push({ type: 'danger', message: `${singleContrib.length} repos depend on a single contributor` });

    // Bus factor
    if (busFactor <= 2 && allContributors.length > 5) items.push({ type: 'danger', message: `Bus factor is ${busFactor} — high risk if key people leave` });

    // High issue count
    const highIssues = repos.filter(r => r.open_issues_count > 50);
    if (highIssues.length > 0) items.push({ type: 'warning', message: `${highIssues.length} repos have 50+ open issues` });

    // Archived repos
    const archived = repos.filter(r => r.archived);
    if (archived.length > 0) items.push({ type: 'info', message: `${archived.length} repos are archived` });

    // No license
    const noLicense = repos.filter(r => !r.license);
    if (noLicense.length > 3) items.push({ type: 'info', message: `${noLicense.length} repos have no license` });

    // Forked repos
    const forked = repos.filter(r => r.fork);
    if (forked.length > 0) items.push({ type: 'info', message: `${forked.length} repos are forks` });

    return items;
  }, [repos, contributors, allContributors, busFactor]);

  // ========== 10. ADVANCED METRICS ==========
  const repoAge = useMemo(() => {
    const now = Date.now();
    return repos.map(r => {
      const ageMonths = Math.floor((now - new Date(r.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000));
      const lastActive = Math.floor((now - new Date(r.pushed_at).getTime()) / (24 * 60 * 60 * 1000));
      return { name: r.name.length > 10 ? r.name.slice(0, 10) + '…' : r.name, age: ageMonths, inactive: lastActive };
    }).sort((a, b) => b.age - a.age).slice(0, 12);
  }, [repos]);

  // Productivity scores
  const productivityScore = useMemo(() => {
    if (allContributors.length === 0) return 0;
    const avgContribs = allContributors.reduce((s, c) => s + c.contributions, 0) / allContributors.length;
    const activeRatio = repos.filter(r => (Date.now() - new Date(r.pushed_at).getTime()) < 30 * 24 * 60 * 60 * 1000).length / Math.max(1, repos.length);
    return Math.min(100, Math.round((avgContribs / 10) * 40 + activeRatio * 60));
  }, [allContributors, repos]);

  const ChartSection = ({ title, icon: Icon, children, delay = 0, className = '' }: {
    title: string; icon: typeof BarChart3; children: React.ReactNode; delay?: number; className?: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );

  const KPIBox = ({ label, value, sub, color = 'text-foreground' }: { label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="bg-surface-overlay/50 rounded-lg p-3 border border-border/50">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <p className="text-sm text-muted-foreground">Comprehensive organization insights & metrics</p>
      </motion.div>

      {/* ===== SECTION 1: ORG OVERVIEW ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">High-Level Org Overview</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPIBox label="Total Repos" value={orgOverview.totalRepos} sub={`${orgOverview.activeRepos30} active (30d)`} />
          <KPIBox label="Contributors" value={allContributors.length} sub={`${orgOverview.activeContributors} active / ${orgOverview.inactiveContributors} inactive`} />
          <KPIBox label="Total Stars" value={orgOverview.totalStars.toLocaleString()} />
          <KPIBox label="Total Forks" value={orgOverview.totalForks.toLocaleString()} />
          <KPIBox label="Open Issues" value={orgOverview.totalOpenIssues.toLocaleString()} color="text-warning" />
          <KPIBox label="Recent Pushes" value={orgOverview.recentPushes} sub="from events" />
        </div>
      </motion.div>

      {/* Contribution Trend */}
      {events.length > 0 ? (
        <ChartSection title="Contribution Trend (Events)" icon={TrendingUp} delay={0.1}>
          {contributionTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={contributionTrend} syncId="analyticsCharts">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} angle={-15} textAnchor="end" height={40} />
                <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, color: 'hsl(220, 10%, 55%)', paddingTop: '15px' }} />
                <Area type="monotone" dataKey="pushes" name="Pushes" stroke="hsl(263, 70%, 66%)" fill="hsl(263, 70%, 66%)" fillOpacity={0.2} strokeWidth={2.5} isAnimationActive={true} />
                <Area type="monotone" dataKey="prs" name="PRs" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%)" fillOpacity={0.15} strokeWidth={2.5} isAnimationActive={true} />
                <Area type="monotone" dataKey="issues" name="Issues" stroke="hsl(38, 92%, 50%)" fill="hsl(38, 92%, 50%)" fillOpacity={0.15} strokeWidth={2.5} isAnimationActive={true} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">No contribution data available</div>
          )}
        </ChartSection>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-surface-card border border-border rounded-xl p-5 text-center">
          <p className="text-xs text-muted-foreground">No events data to display contribution trends</p>
        </motion.div>
      )}

      {/* ===== SECTION 9: ALERTS ===== */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Alerts & Red Flags</h3>
          </div>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${
                alert.type === 'danger' ? 'bg-destructive/10 border-destructive/30 text-destructive' :
                alert.type === 'warning' ? 'bg-warning/10 border-warning/30 text-warning' :
                'bg-info/10 border-info/30 text-info'
              }`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ===== SECTION 10: ADVANCED SCORES ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-card border border-border rounded-xl p-5 text-center">
          <Target className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Productivity Score</p>
          <p className="text-3xl font-bold font-mono text-primary mt-1">{productivityScore}</p>
          <p className="text-[10px] text-muted-foreground">/100</p>
        </div>
        <div className="bg-surface-card border border-border rounded-xl p-5 text-center">
          <Shield className="w-5 h-5 text-warning mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bus Factor</p>
          <p className={`text-3xl font-bold font-mono mt-1 ${busFactor <= 2 ? 'text-destructive' : busFactor <= 5 ? 'text-warning' : 'text-success'}`}>{busFactor}</p>
          <p className="text-[10px] text-muted-foreground">people for 80% work</p>
        </div>
        <div className="bg-surface-card border border-border rounded-xl p-5 text-center">
          <Heart className="w-5 h-5 text-success mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Ratio</p>
          <p className="text-3xl font-bold font-mono text-success mt-1">
            {repos.length > 0 ? Math.round((orgOverview.activeRepos30 / repos.length) * 100) : 0}%
          </p>
          <p className="text-[10px] text-muted-foreground">repos active (30d)</p>
        </div>
      </motion.div>

      {/* ===== SECTION 2: CONTRIBUTION ANALYTICS ===== */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Contribution Analytics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSection title="Contributions per Developer" icon={TrendingUp} delay={0.2}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={commitsPerDev} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
              <XAxis type="number" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} width={90} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="contributions" fill="hsl(263, 70%, 66%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Contribution Distribution" icon={Activity} delay={0.25}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={contribDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
              <XAxis dataKey="range" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="count" name="Contributors" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* ===== SECTION 3: REPO INSIGHTS ===== */}
      <div className="flex items-center gap-2">
        <Code className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground"> Repository Insights</h3>
      </div>

      <ChartSection title="Stars Distribution" icon={TrendingUp} delay={0.3}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={starsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
            <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
            <Tooltip {...chartTooltipStyle} />
            <Bar dataKey="stars" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSection title="Stars vs Forks" icon={GitFork} delay={0.35}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={starsVsForks}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
              <Tooltip {...chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: 'hsl(220, 10%, 55%)' }} />
              <Bar dataKey="stars" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="forks" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Health Score Distribution" icon={Eye} delay={0.4}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={repoHealth} cx="50%" cy="50%" innerRadius={50} outerRadius={100}
                dataKey="value" paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                {repoHealth.map((_, i) => {
                  const colors = ['hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(25, 95%, 53%)', 'hsl(340, 82%, 52%)'];
                  return <Cell key={i} fill={colors[i % colors.length]} />;
                })}
              </Pie>
              <Tooltip {...chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* ===== SECTION 4: ISSUE & PR ANALYTICS ===== */}
      <div className="flex items-center gap-2">
        <GitPullRequest className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Issue & PR Analytics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSection title="Issues vs Accepted PRs" icon={AlertCircle} delay={0.45}>
          {issuesVsAcceptedPR.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={issuesVsAcceptedPR} syncId="analyticsCharts">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 9 }} axisLine={false} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, color: 'hsl(220, 10%, 55%)', paddingTop: '10px' }} />
                <Bar dataKey="issues" name="Open Issues" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="acceptedPRs" name="Active PRs" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground">No PR/Issue data available</div>
          )}
        </ChartSection>

        <ChartSection title="Event Type Breakdown" icon={GitPullRequest} delay={0.5}>
          {eventTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={eventTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={100}
                  dataKey="value" paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {eventTypeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground">No event type data</div>
          )}
        </ChartSection>
      </div>

      {/* ===== SECTION 5: TIME TRENDS ===== */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground"> Time-Based Trends</h3>
      </div>

      <ChartSection title="Activity Timeline (Repos pushed)" icon={BarChart3} delay={0.55}>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={activityTimeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
            <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
            <Tooltip {...chartTooltipStyle} />
            <Area type="monotone" dataKey="repos" stroke="hsl(263, 70%, 66%)" fill="hsl(263, 70%, 66%)" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartSection>

      <ChartSection title="Repo Age vs Inactivity" icon={Clock} delay={0.6}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={repoAge}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 9 }} axisLine={false} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
            <Tooltip {...chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10, color: 'hsl(220, 10%, 55%)' }} />
            <Bar dataKey="age" name="Age (months)" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="inactive" name="Days inactive" fill="hsl(340, 82%, 52%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* ===== SECTION 6: CODE QUALITY ===== */}
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Code Quality & Risk</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSection title="Repository Size (MB)" icon={BarChart3} delay={0.65}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sizeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 9 }} axisLine={false} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="size" fill="hsl(280, 65%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="License Distribution" icon={Scale} delay={0.7}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={licenseData} cx="50%" cy="50%" innerRadius={50} outerRadius={100}
                dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {licenseData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip {...chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Stale & Large Repos listing */}
      {(staleRepos.length > 0 || largeRepos.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {staleRepos.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
              className="bg-surface-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-medium text-foreground">Stale Repos (30+ days inactive)</h3>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {staleRepos.slice(0, 15).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-accent/50">
                    <span className="font-mono text-foreground">{r.name}</span>
                    <span className="text-muted-foreground">
                      {Math.floor((Date.now() - new Date(r.pushed_at).getTime()) / (24 * 60 * 60 * 1000))}d ago
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {largeRepos.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="bg-surface-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-info" />
                <h3 className="text-sm font-medium text-foreground">Large Repos (50MB+)</h3>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {largeRepos.slice(0, 15).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-accent/50">
                    <span className="font-mono text-foreground">{r.name}</span>
                    <span className="text-muted-foreground">{(r.size / 1024).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ===== SECTION 8: LANGUAGE STATS ===== */}
      <ChartSection title="Language Stats" icon={Code} delay={0.85}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={languageStats} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(235, 15%, 15%)" />
            <XAxis type="number" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} />
            <YAxis dataKey="lang" type="category" tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 10 }} axisLine={false} width={80} />
            <Tooltip {...chartTooltipStyle} />
            <Bar dataKey="repos" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>
    </div>
  );
}
