import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, ArrowUpDown, Star, GitFork, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import HealthBadge from '@/components/shared/HealthBadge';
import { formatDistanceToNow } from 'date-fns';

type SortKey = 'pushed_at' | 'stargazers_count' | 'forks_count' | 'open_issues_count' | 'name';

export default function RepositoriesPage() {
  const { repos, healthScores, languages } = useAppStore();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('pushed_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showArchived, setShowArchived] = useState(false);

  const allLanguages = useMemo(() => Array.from(languages.keys()).sort(), [languages]);

  const filtered = useMemo(() => {
    let result = repos.filter(r => {
      if (!showArchived && r.archived) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && 
          !(r.description || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (langFilter !== 'all' && r.language !== langFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortBy === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortBy === 'pushed_at') { av = new Date(a.pushed_at).getTime(); bv = new Date(b.pushed_at).getTime(); }
      else { av = a[sortBy]; bv = b[sortBy]; }
      
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [repos, search, langFilter, sortBy, sortDir, showArchived]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h2 className="text-lg font-semibold text-foreground">Repositories</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{filtered.length} of {repos.length} repositories</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 items-stretch sm:items-center bg-surface-card border border-border rounded-xl p-2 sm:p-3"
      >
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-9 bg-surface-page border-border text-xs sm:text-sm"
          />
        </div>
        <Select value={langFilter} onValueChange={setLangFilter}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px] bg-surface-page border-border text-xs sm:text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            {allLanguages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
          className="text-xs w-full sm:w-auto"
        >
          {showArchived ? 'Hide' : 'Show'} Archived
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-surface-card border border-border rounded-xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-surface-card/50">
                <th className="text-left p-2 sm:p-3 font-medium">Health</th>
                <th className="text-left p-2 sm:p-3 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">Repo <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="hidden sm:table-cell text-left p-2 sm:p-3 font-medium">Language</th>
                <th className="hidden md:table-cell text-right p-2 sm:p-3 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort('stargazers_count')}>
                  <span className="flex items-center gap-1 justify-end"><Star className="w-3 h-3" /> Stars</span>
                </th>
                <th className="hidden lg:table-cell text-right p-2 sm:p-3 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort('forks_count')}>
                  <span className="flex items-center gap-1 justify-end"><GitFork className="w-3 h-3" /> Forks</span>
                </th>
                <th className="hidden 2xl:table-cell text-right p-2 sm:p-3 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort('open_issues_count')}>
                  <span className="flex items-center gap-1 justify-end"><AlertCircle className="w-3 h-3" /> Issues</span>
                </th>
                <th className="text-right p-2 sm:p-3 font-medium text-xs">Last Push</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((repo, i) => {
                const health = healthScores.get(repo.id);
                return (
                  <motion.tr
                    key={repo.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="border-b border-border/50 hover:bg-accent/40 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/repo/${repo.name}`)}
                  >
                    <td className="p-2 sm:p-3">
                      {health && <HealthBadge grade={health.grade} score={health.total} />}
                    </td>
                    <td className="p-2 sm:p-3 min-w-0">
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{repo.name}</span>
                          {repo.archived && <span className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground whitespace-nowrap flex-shrink-0">Archived</span>}
                          {repo.fork && <span className="text-[9px] px-1 py-0 rounded bg-info/10 text-info whitespace-nowrap flex-shrink-0">Fork</span>}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{repo.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell p-2 sm:p-3">
                      {repo.language && (
                        <span className="text-xs font-mono text-muted-foreground">{repo.language}</span>
                      )}
                    </td>
                    <td className="hidden md:table-cell p-2 sm:p-3 text-right text-xs font-mono text-foreground">{repo.stargazers_count.toLocaleString()}</td>
                    <td className="hidden lg:table-cell p-2 sm:p-3 text-right text-xs font-mono text-foreground">{repo.forks_count.toLocaleString()}</td>
                    <td className="hidden 2xl:table-cell p-2 sm:p-3 text-right text-xs font-mono text-foreground">{repo.open_issues_count.toLocaleString()}</td>
                    <td className="p-2 sm:p-3 text-right text-xs text-muted-foreground">
                      <span className="block lg:inline">{formatDistanceToNow(new Date(repo.pushed_at), { addSuffix: false })}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No repositories match your filters
          </div>
        )}
      </motion.div>
    </div>
  );
}
