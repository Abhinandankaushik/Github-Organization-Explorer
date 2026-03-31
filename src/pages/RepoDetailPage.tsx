import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, GitFork, Star, AlertCircle, Eye, Scale, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import HealthBadge from '@/components/shared/HealthBadge';
import { formatDistanceToNow } from 'date-fns';

export default function RepoDetailPage() {
  const { repoName } = useParams();
  const navigate = useNavigate();
  const { org, repos, healthScores, contributors, orgName, isLoading, loadOrg } = useAppStore();

  // Load org data if not loaded yet
  useEffect(() => {
    if (!org || org.login !== orgName) {
      loadOrg(orgName);
    }
  }, [org, orgName, loadOrg]);

  const repo = repos.find(r => r.name === repoName);
  const health = repo ? healthScores.get(repo.id) : undefined;
  const repoContribs = repoName ? contributors.get(repoName) || [] : [];

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="animate-pulse">
          <div className="h-8 w-24 shimmer rounded mb-4" />
          <div className="space-y-3 mb-4"><div className="h-7 w-64 shimmer rounded" /><div className="h-4 w-80 shimmer rounded" /></div>
        </motion.div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-card border border-border rounded-lg sm:rounded-xl p-2 sm:p-4 text-center animate-pulse">
              <div className="w-4 h-4 bg-primary/20 rounded mx-auto mb-1 sm:mb-2" />
              <div className="h-6 w-12 shimmer rounded mx-auto mb-1" />
              <div className="h-3 w-10 shimmer rounded mx-auto" />
            </div>
          ))}
        </div>
        <div className="bg-surface-card border border-border rounded-xl p-5 animate-pulse">
          <div className="h-6 w-32 shimmer rounded mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="text-center"><div className="h-4 w-16 shimmer rounded mx-auto mb-2" /><div className="h-8 w-12 shimmer rounded mx-auto mb-1" /><div className="h-3 w-14 shimmer rounded mx-auto" /></div>))}
          </div>
        </div>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Repository not found</p>
        <Button variant="ghost" onClick={() => navigate('/repositories')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to repositories
        </Button>
      </div>
    );
  }

  const stats = [
    { icon: Star, label: 'Stars', value: repo.stargazers_count },
    { icon: GitFork, label: 'Forks', value: repo.forks_count },
    { icon: AlertCircle, label: 'Issues', value: repo.open_issues_count },
    { icon: Eye, label: 'Watchers', value: repo.watchers_count },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/repositories')} className="mb-3 sm:mb-4 text-muted-foreground text-xs sm:text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Repositories</span>
        </Button>
        
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate">{repo.name}</h2>
              {repo.archived && <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-muted text-muted-foreground">Archived</span>}
              {repo.fork && <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-info/10 text-info">Fork</span>}
            </div>
            {repo.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{repo.description}</p>}
            {repo.topics && repo.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2">
                {repo.topics.map(t => (
                  <span key={t} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono line-clamp-1">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {health && <HealthBadge grade={health.grade} score={health.total} size="lg" />}
            <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-9">
                <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">GitHub</span>
              </Button>
            </a>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-card border border-border rounded-lg sm:rounded-xl p-2 sm:p-4 text-center"
          >
            <Icon className="w-3 sm:w-4 h-3 sm:h-4 text-primary mx-auto mb-0.5 sm:mb-1" />
            <p className="text-sm sm:text-lg font-semibold text-foreground font-mono">{value.toLocaleString()}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Health Score Breakdown */}
      {health && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-card border border-border rounded-xl p-5"
        >
          <h3 className="text-sm font-medium text-foreground mb-4">Health Score Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Commits', score: health.commitFrequency, max: 25 },
              { label: 'Issues', score: health.issueResolution, max: 20 },
              { label: 'PR Velocity', score: health.prVelocity, max: 20 },
              { label: 'Docs', score: health.documentation, max: 15 },
              { label: 'CI/CD', score: health.cicd, max: 10 },
              { label: 'Recency', score: health.recency, max: 10 },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className="relative w-full h-2 bg-surface-overlay rounded-full overflow-hidden mb-2">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full gradient-primary transition-all duration-1000"
                    style={{ width: `${(item.score / item.max) * 100}%` }}
                  />
                </div>
                <p className="text-xs font-mono text-foreground">{item.score}/{item.max}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Info & Contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Repo Info */}
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-3">Information</h3>
          <div className="space-y-2.5 text-xs">
            {repo.language && (
              <div className="flex justify-between"><span className="text-muted-foreground">Language</span><span className="font-mono text-foreground">{repo.language}</span></div>
            )}
            {repo.license && (
              <div className="flex justify-between"><span className="text-muted-foreground">License</span><span className="flex items-center gap-1 text-foreground"><Scale className="w-3 h-3" />{repo.license.name}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Default Branch</span><span className="font-mono text-foreground">{repo.default_branch}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-mono text-foreground">{(repo.size / 1024).toFixed(1)} MB</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-foreground">{formatDistanceToNow(new Date(repo.created_at), { addSuffix: true })}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Last Push</span><span className="text-foreground">{formatDistanceToNow(new Date(repo.pushed_at), { addSuffix: true })}</span></div>
          </div>
        </div>

        {/* Contributors */}
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Top Contributors <span className="text-muted-foreground font-normal">({repoContribs.length})</span>
          </h3>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {repoContribs.slice(0, 15).map((c, i) => (
              <div key={c.login} className="flex items-center gap-3 py-1.5">
                <span className="text-[10px] text-muted-foreground font-mono w-5 text-right">{i + 1}</span>
                <img src={c.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                <a href={c.html_url} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground hover:text-primary flex-1">{c.login}</a>
                <span className="text-xs font-mono text-muted-foreground">{c.contributions}</span>
              </div>
            ))}
            {repoContribs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No contributor data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
