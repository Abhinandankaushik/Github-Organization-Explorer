import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Search, X, Maximize } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  PHP: '#4F5D95', Scala: '#c22d40', Kotlin: '#A97BFF', Shell: '#89e051',
  HTML: '#e34c26', CSS: '#563d7c', Dart: '#00B4AB', Swift: '#F05138',
};

const EDGE_COLORS = [
  '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#22d3ee',
  '#fb923c', '#a855f7', '#4ade80', '#f87171',
];

interface Vec2 { x: number; y: number }
interface RepoNode { id: string; name: string; type: 'repo'; language: string | null; stars: number; forks: number; issues: number; description: string | null; x: number; y: number; vx: number; vy: number }
interface ContribNode { id: string; name: string; type: 'contributor'; contributions: number; avatar: string; repoCount: number; x: number; y: number; vx: number; vy: number }
type GraphNode = RepoNode | ContribNode;
interface Edge { from: string; to: string; weight: number; repoName: string; colorIdx: number }

export default function NetworkPage() {
  const { repos, contributors, allContributors } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Map<string, GraphNode>>(new Map());
  const edgesRef = useRef<Edge[]>([]);

  // Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Interaction state
  const dragRef = useRef<{ nodeId: string | null; panStart: Vec2 | null; isPan: boolean }>({ nodeId: null, panStart: null, isPan: false });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mouseScreen, setMouseScreen] = useState<Vec2>({ x: 0, y: 0 });
  const hoveredRef = useRef<GraphNode | null>(null);

  // Filter state
  const [minContributors, setMinContributors] = useState(1);
  const [minRepos, setMinRepos] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maxContributorsShow, setMaxContributorsShow] = useState(Math.min(50, allContributors.length));

  // Build graph data with filters
  const { nodeCount, edgeCount } = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const edges: Edge[] = [];
    const cx = 600, cy = 400;

    // Count repos per contributor for filtering
    const contribRepoCount = new Map<string, number>();
    contributors.forEach(contribs => {
      contribs.forEach(c => contribRepoCount.set(c.login, (contribRepoCount.get(c.login) || 0) + 1));
    });

    // Filter and add repos
    repos.forEach((r, i) => {
      const angle = (i / Math.max(1, repos.length)) * Math.PI * 2;
      const radius = 200 + Math.random() * 150;
      nodes.set(`repo-${r.name}`, {
        id: `repo-${r.name}`, name: r.name, type: 'repo',
        language: r.language, stars: r.stargazers_count, forks: r.forks_count,
        issues: r.open_issues_count, description: r.description,
        x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 60,
        y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 60,
        vx: 0, vy: 0,
      });
    });

    // Filter and add contributors
    const filteredContributors = allContributors
      .filter(c => {
        const repoCount = contribRepoCount.get(c.login) || 1;
        const meetsRepoFilter = repoCount >= minRepos;
        const meetsContribFilter = c.contributions >= minContributors;
        return meetsRepoFilter && meetsContribFilter;
      })
      .slice(0, maxContributorsShow);

    filteredContributors.forEach((c, i) => {
      const angle = (i / Math.max(1, filteredContributors.length)) * Math.PI * 2;
      const radius = 400 + Math.random() * 100;
      nodes.set(`user-${c.login}`, {
        id: `user-${c.login}`, name: c.login, type: 'contributor',
        contributions: c.contributions, avatar: c.avatar_url,
        repoCount: contribRepoCount.get(c.login) || 1,
        x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
      });
    });

    // Edges only for nodes that passed filters
    let colorIdx = 0;
    contributors.forEach((contribs, repoName) => {
      contribs.forEach(c => {
        if (nodes.has(`user-${c.login}`) && nodes.has(`repo-${repoName}`)) {
          edges.push({ from: `user-${c.login}`, to: `repo-${repoName}`, weight: c.contributions, repoName, colorIdx: colorIdx++ % EDGE_COLORS.length });
        }
      });
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
    return { nodeCount: nodes.size, edgeCount: edges.length };
  }, [repos, contributors, allContributors, minContributors, minRepos, maxContributorsShow]);

  // Helper function to check if node matches search
  const matchesSearch = useCallback((node: GraphNode): boolean => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return node.name.toLowerCase().includes(query);
  }, [searchQuery]);

  // Simple force simulation
  useEffect(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes.size === 0) return;

    let iteration = 0;
    const maxIterations = 200;
    const maxEdgeWeight = Math.max(1, ...edges.map(e => e.weight));

    function simulate() {
      if (iteration >= maxIterations) return;
      iteration++;

      const nodeArr = Array.from(nodes.values());
      const cx = 600, cy = 400;

      // Repulsion
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const a = nodeArr[i], b = nodeArr[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = 800 / (dist * dist);
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const a = nodes.get(edge.from), b = nodes.get(edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const strength = 0.003 * (edge.weight / maxEdgeWeight);
        const fx = dx * strength, fy = dy * strength;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center gravity
      for (const node of nodeArr) {
        node.vx += (cx - node.x) * 0.0005;
        node.vy += (cy - node.y) * 0.0005;
      }

      // Apply velocity with damping
      const damping = 0.85;
      for (const node of nodeArr) {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      }
    }

    // Run simulation quickly
    const interval = setInterval(() => {
      for (let i = 0; i < 5; i++) simulate();
    }, 16);

    setTimeout(() => clearInterval(interval), 4000);
    return () => clearInterval(interval);
  }, [nodeCount, edgeCount]);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const images = new Map<string, HTMLImageElement>();

    function loadImage(url: string) {
      if (images.has(url)) return images.get(url)!;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      images.set(url, img);
      return img;
    }

    function draw() {
      if (!ctx || !canvas) return;
      const container = containerRef.current;
      if (!container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

      const cam = cameraRef.current;
      ctx.clearRect(0, 0, w, h);

      // Apply camera transform
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-w / 2 + cam.x, -h / 2 + cam.y);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const hovered = hoveredRef.current;
      const maxEdgeWeight = Math.max(1, ...edges.map(e => e.weight));

      const hoveredEdgeSet = new Set<number>();
      if (hovered) {
        edges.forEach((e, i) => {
          if (e.from === hovered.id || e.to === hovered.id) hoveredEdgeSet.add(i);
        });
      }

      // Draw edges
      edges.forEach((edge, i) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!from || !to) return;
        const isHighlighted = hovered ? hoveredEdgeSet.has(i) : false;
        const fromMatches = matchesSearch(from);
        const toMatches = matchesSearch(to);
        const edgeMatches = fromMatches || toMatches;
        const normalizedW = edge.weight / maxEdgeWeight;
        const lineWidth = 0.5 + normalizedW * 3;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = EDGE_COLORS[edge.colorIdx];

        if (searchQuery) {
          ctx.globalAlpha = edgeMatches ? (isHighlighted ? 0.9 : 0.55 + normalizedW * 0.35) : 0.02;
        } else {
          ctx.globalAlpha = hovered ? (isHighlighted ? 0.7 : 0.04) : 0.12 + normalizedW * 0.2;
        }
        
        ctx.lineWidth = edgeMatches && searchQuery ? lineWidth + 1.5 : (isHighlighted ? lineWidth + 1 : lineWidth);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      const maxStars = Math.max(1, ...Array.from(nodes.values()).filter(n => n.type === 'repo').map(n => (n as RepoNode).stars));
      const maxContrib = Math.max(1, ...Array.from(nodes.values()).filter(n => n.type === 'contributor').map(n => (n as ContribNode).contributions));

      // Draw nodes
      nodes.forEach(node => {
        const isHovered = hovered?.id === node.id;
        const isConnected = hovered ? hoveredEdgeSet.size > 0 && edges.some((e, i) => hoveredEdgeSet.has(i) && (e.from === node.id || e.to === node.id)) : false;
        const searchMatches = matchesSearch(node);
        const dimmed = searchQuery ? !searchMatches : (hovered && !isHovered && !isConnected);

        ctx.globalAlpha = dimmed ? (searchQuery ? 0.12 : 0.15) : 1;

        if (node.type === 'repo') {
          const repoNode = node as RepoNode;
          const size = 8 + (repoNode.stars / maxStars) * 14;
          const color = LANG_COLORS[repoNode.language || ''] || '#a78bfa';

          if ((isHovered && !searchQuery) || (searchQuery && searchMatches)) {
            ctx.shadowColor = searchQuery && searchMatches ? '#fbbf24' : color;
            ctx.shadowBlur = searchQuery && searchMatches ? 20 : 15;
          }

          ctx.fillStyle = color;
          ctx.globalAlpha = dimmed ? (searchQuery ? 0.08 : 0.1) : (searchQuery && searchMatches ? 0.95 : (isHovered && !searchQuery ? 0.95 : 0.7));
          ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);
          ctx.strokeStyle = searchQuery && searchMatches ? '#fbbf24' : color;
          ctx.lineWidth = (isHovered || (searchQuery && searchMatches)) ? 3 : 1;
          ctx.strokeRect(node.x - size, node.y - size, size * 2, size * 2);

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          // Label
          ctx.globalAlpha = dimmed ? (searchQuery ? 0.08 : 0.1) : (searchQuery && searchMatches ? 1 : (isHovered && !searchQuery ? 1 : 0.8));
          ctx.fillStyle = searchQuery && searchMatches ? '#fbbf24' : '#e2e8f0';
          ctx.font = '9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.name.length > 14 ? node.name.slice(0, 14) + '…' : node.name, node.x, node.y + size + 12);
        } else {
          const contribNode = node as ContribNode;
          const size = 6 + (contribNode.contributions / maxContrib) * 12;

          if (isHovered && !searchQuery) {
            ctx.shadowColor = '#a78bfa';
            ctx.shadowBlur = 15;
          }

          // Draw avatar circle
          const img = loadImage(contribNode.avatar);
          if ((isHovered && !searchQuery) || (searchQuery && searchMatches)) {
            ctx.shadowColor = searchQuery && searchMatches ? '#fbbf24' : '#a78bfa';
            ctx.shadowBlur = searchQuery && searchMatches ? 20 : 15;
          }
          
          if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, node.x - size, node.y - size, size * 2, size * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.strokeStyle = searchQuery && searchMatches ? '#fbbf24' : (isHovered ? '#a78bfa' : '#6366f1');
            ctx.lineWidth = (isHovered || (searchQuery && searchMatches)) ? 3 : 1;
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fillStyle = '#a78bfa';
            ctx.globalAlpha = dimmed ? (searchQuery ? 0.08 : 0.1) : (searchQuery && searchMatches ? 0.9 : (isHovered ? 0.85 : 0.6));
            ctx.fill();
            ctx.strokeStyle = searchQuery && searchMatches ? '#fbbf24' : (isHovered ? '#a78bfa' : '#6366f1');
            ctx.lineWidth = (isHovered || (searchQuery && searchMatches)) ? 3 : 1;
            ctx.stroke();
          }

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          // Label
          ctx.globalAlpha = dimmed ? (searchQuery ? 0.08 : 0.12) : (searchQuery && searchMatches ? 1 : 0.85);
          ctx.fillStyle = searchQuery && searchMatches ? '#fbbf24' : '#e2e8f0';
          ctx.font = '8px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.name.length > 12 ? node.name.slice(0, 12) + '…' : node.name, node.x, node.y + size + 11);
        }
        ctx.globalAlpha = 1;
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodeCount, edgeCount, searchQuery, matchesSearch]);

  // Screen to world coords
  const screenToWorld = useCallback((sx: number, sy: number): Vec2 => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: sx, y: sy };
    const container = containerRef.current;
    if (!container) return { x: sx, y: sy };
    const w = container.clientWidth, h = container.clientHeight;
    const cam = cameraRef.current;
    return {
      x: (sx - w / 2) / cam.zoom + w / 2 - cam.x,
      y: (sy - h / 2) / cam.zoom + h / 2 - cam.y,
    };
  }, []);

  const findNodeAt = useCallback((wx: number, wy: number): GraphNode | null => {
    const nodes = nodesRef.current;
    let closest: GraphNode | null = null;
    let closestDist = Infinity;
    nodes.forEach(node => {
      const dx = node.x - wx, dy = node.y - wy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = node.type === 'repo' ? 20 : 18;
      if (dist < hitRadius && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    });
    return closest;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    const node = findNodeAt(world.x, world.y);

    if (node) {
      dragRef.current = { nodeId: node.id, panStart: null, isPan: false };
    } else {
      dragRef.current = { nodeId: null, panStart: { x: e.clientX, y: e.clientY }, isPan: true };
    }
  }, [screenToWorld, findNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    setMouseScreen({ x: sx, y: sy });

    const drag = dragRef.current;
    if (drag.nodeId) {
      const world = screenToWorld(sx, sy);
      const node = nodesRef.current.get(drag.nodeId);
      if (node) {
        node.x = world.x;
        node.y = world.y;
        node.vx = 0;
        node.vy = 0;
      }
    } else if (drag.isPan && drag.panStart) {
      const dx = e.clientX - drag.panStart.x;
      const dy = e.clientY - drag.panStart.y;
      drag.panStart = { x: e.clientX, y: e.clientY };
      setCamera(prev => ({ ...prev, x: prev.x + dx / prev.zoom, y: prev.y + dy / prev.zoom }));
    } else {
      const world = screenToWorld(sx, sy);
      const node = findNodeAt(world.x, world.y);
      hoveredRef.current = node;
      setHoveredNode(node);
    }
  }, [screenToWorld, findNodeAt]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = { nodeId: null, panStart: null, isPan: false };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(5, prev.zoom * delta)) }));
  }, []);

  const resetView = useCallback(() => setCamera({ x: 0, y: 0, zoom: 1 }), []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, [isFullscreen]);

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Network Graph</h2>
          <p className="text-sm text-muted-foreground">
            {nodeCount} nodes · {edgeCount} connections — scroll to zoom, drag to pan/move nodes
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setCamera(p => ({ ...p, zoom: Math.min(5, p.zoom * 1.3) }))}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setCamera(p => ({ ...p, zoom: Math.max(0.1, p.zoom * 0.7) }))}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetView}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Filters & Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Bar */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search repos or contributors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Min Contributions Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">Min Contributions</label>
              <span className="text-xs text-muted-foreground font-mono">{minContributors}</span>
            </div>
            <input
              type="range"
              min="1"
              max={Math.max(50, Math.max(...allContributors.map(c => c.contributions)))}
              value={minContributors}
              onChange={(e) => setMinContributors(parseInt(e.target.value))}
              className="w-full h-2 bg-surface-overlay rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Min Repos Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">Min Repos</label>
              <span className="text-xs text-muted-foreground font-mono">{minRepos}</span>
            </div>
            <input
              type="range"
              min="1"
              max={repos.length}
              value={minRepos}
              onChange={(e) => setMinRepos(parseInt(e.target.value))}
              className="w-full h-2 bg-surface-overlay rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Max Contributors to Show */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">Show Contributors</label>
              <span className="text-xs text-muted-foreground font-mono">{maxContributorsShow}</span>
            </div>
            <input
              type="range"
              min="1"
              max={allContributors.length}
              value={maxContributorsShow}
              onChange={(e) => setMaxContributorsShow(parseInt(e.target.value))}
              className="w-full h-2 bg-surface-overlay rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        ref={containerRef}
        className="bg-surface-card border border-border rounded-xl overflow-hidden relative"
        style={{
          height: isFullscreen ? '100vh' : 'calc(100vh - 360px)',
          minHeight: '420px',
          cursor: dragRef.current.nodeId ? 'grabbing' : dragRef.current.isPan ? 'move' : 'default',
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); hoveredRef.current = null; setHoveredNode(null); }}
          onWheel={handleWheel}
        />

        {/* Tooltip */}
        {hoveredNode && !dragRef.current.nodeId && (
          <div
            className="absolute pointer-events-none z-50 bg-popover/95 backdrop-blur-md rounded-lg p-3 border border-border shadow-xl text-xs max-w-[260px]"
            style={{
              left: Math.min(mouseScreen.x + 16, (containerRef.current?.clientWidth || 800) - 280),
              top: Math.max(10, Math.min(mouseScreen.y - 10, (containerRef.current?.clientHeight || 600) - 160)),
            }}
          >
            {hoveredNode.type === 'repo' ? (
              <div className="space-y-1.5">
                <p className="font-semibold text-popover-foreground text-sm">{hoveredNode.name}</p>
                {(hoveredNode as RepoNode).description && (
                  <p className="text-muted-foreground line-clamp-2">{(hoveredNode as RepoNode).description}</p>
                )}
                <div className="flex gap-3 text-muted-foreground">
                  <span>⭐ {(hoveredNode as RepoNode).stars}</span>
                  <span>🍴 {(hoveredNode as RepoNode).forks}</span>
                  <span>🐛 {(hoveredNode as RepoNode).issues}</span>
                </div>
                {(hoveredNode as RepoNode).language && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LANG_COLORS[(hoveredNode as RepoNode).language || ''] || '#a78bfa' }} />
                    <span className="text-muted-foreground">{(hoveredNode as RepoNode).language}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <img src={(hoveredNode as ContribNode).avatar} alt="" className="w-6 h-6 rounded-full" />
                  <p className="font-semibold text-popover-foreground text-sm">{hoveredNode.name}</p>
                </div>
                <p className="text-muted-foreground">
                  {(hoveredNode as ContribNode).contributions.toLocaleString()} contributions across {(hoveredNode as ContribNode).repoCount} repos
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom legend - stats */}
        <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground bg-surface-card/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/70" /> Repos</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary/60" /> Contributors</div>
            <span>Edge width = contributions</span>
            {searchQuery && (
              <span className="text-xs ml-2 px-2 py-1 rounded bg-primary/10 text-primary">Filtered by: "{searchQuery}"</span>
            )}
          </div>
        </div>

        {/* Stats panel */}
        <div className="absolute top-3 right-3 text-[11px] text-muted-foreground bg-surface-card/80 backdrop-blur-sm rounded-lg px-4 py-3 border border-border space-y-1">
          <div className="font-semibold text-foreground mb-2">Graph Stats</div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span>Repos:</span>
              <span className="font-mono text-primary font-semibold">{nodeCount <= allContributors.length ? nodeCount : Math.max(0, nodeCount - allContributors.length)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Contributors:</span>
              <span className="font-mono text-primary font-semibold">{nodeCount > repos.length ? nodeCount - repos.length : 0}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Connections:</span>
              <span className="font-mono text-info font-semibold">{edgeCount}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
