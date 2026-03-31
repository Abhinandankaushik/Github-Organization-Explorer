import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitFork, Users, Star, AlertCircle, Activity } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import KPICard from '@/components/shared/KPICard';
import SkeletonCard from '@/components/shared/SkeletonCard';
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap';
import LanguageChart from '@/components/dashboard/LanguageChart';
import EventFeed from '@/components/dashboard/EventFeed';

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function DashboardPage() {
  const { org, repos, allContributors, isLoading, isSetup, mode, selectedOrgs, loadOrg } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSetup) navigate('/');
    else if (mode === 'multi') navigate('/comparison');
    else if (!org) loadOrg();
  }, [isSetup, org, mode, selectedOrgs]);

  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);
  const totalIssues = repos.reduce((s, r) => s + r.open_issues_count, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">Dashboard</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Organization health at a glance</p>
      </motion.div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KPICard title="Repositories" value={repos.length} icon={GitFork} delay={0} />
            <KPICard title="Contributors" value={allContributors.length} icon={Users} delay={100} />
            <KPICard title="Total Stars" value={totalStars} icon={Star} delay={200} />
            <KPICard title="Open Issues" value={totalIssues} icon={AlertCircle} delay={300} />
          </>
        )}
      </div>

      {/* Activity Heatmap */}
      <motion.div
        variants={cardVariants} custom={1} initial="hidden" animate="visible"
        className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all duration-300"
        whileHover={{ scale: 1.002 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Activity Heatmap</h3>
        </div>
        <ActivityHeatmap repos={repos} />
      </motion.div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <motion.div
          variants={cardVariants} custom={2} initial="hidden" animate="visible"
          className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all duration-300"
          whileHover={{ scale: 1.005 }}
        >
          <h3 className="text-sm font-medium text-foreground mb-4">Language Distribution</h3>
          <LanguageChart />
        </motion.div>

        <motion.div
          variants={cardVariants} custom={3} initial="hidden" animate="visible"
          className="bg-surface-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all duration-300"
          whileHover={{ scale: 1.005 }}
        >
          <h3 className="text-sm font-medium text-foreground mb-4">Recent Activity</h3>
          <EventFeed />
        </motion.div>
      </div>
    </div>
  );
}
