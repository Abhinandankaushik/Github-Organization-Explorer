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
  const { org, repos, contributors, allContributors, isLoading, orgName, loadOrg } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Map<string, GraphNode>>(new Map());
  const edgesRef = useRef<Edge[]>([]);
  const scrollLockRef = useRef<boolean>(false);

  // Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Interaction state
  const dragRef = useRef<{ nodeId: string | null; panStart: Vec2 | null; isPan: boolean }>({ nodeId: null, panStart: null, isPan: false });
  const touchStartDistanceRef = useRef<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [mouseScreen, setMouseScreen] = useState<Vec2>({ x: 0, y: 0 });
  const hoveredRef = useRef<GraphNode | null>(null);
  const selectedRef = useRef<GraphNode | null>(null);

  // Filter state
  const [minContributors, setMinContributors] = useState(1);
  const [minRepos, setMinRepos] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maxContributorsShow, setMaxContributorsShow] = useState(Math.min(50, allContributors.length));
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Handle window resize for responsive height
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load org data if not loaded yet
  useEffect(() => {
    if (!org || org.login !== orgName) {
      loadOrg(orgName);
    }
  }, [org, orgName, loadOrg]);

  // Prevent scroll-to-top when zooming on mobile
  useEffect(() => {
    if (scrollLockRef.current && window.innerWidth < 768) {
      window.scrollTo(0, 0);
      scrollLockRef.current = false;
    }
  }, [camera.zoom]);

  // Setup canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, [screenWidth, isFullscreen]);

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
      const selected = selectedRef.current;
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
        const isSelected = selected?.id === node.id;
        const isHighlighted = isHovered || isSelected;
        const isConnected = hovered ? hoveredEdgeSet.size > 0 && edges.some((e, i) => hoveredEdgeSet.has(i) && (e.from === node.id || e.to === node.id)) : false;
        const searchMatches = matchesSearch(node);
        const dimmed = searchQuery ? !searchMatches : (hovered && !isHovered && !isConnected);

        ctx.globalAlpha = dimmed ? (searchQuery ? 0.12 : 0.15) : 1;

        if (node.type === 'repo') {
          const repoNode = node as RepoNode;
          const size = 8 + (repoNode.stars / maxStars) * 14;
          const color = LANG_COLORS[repoNode.language || ''] || '#a78bfa';

          if ((isHighlighted && !searchQuery) || (searchQuery && searchMatches)) {
            ctx.shadowColor = searchQuery && searchMatches ? '#fbbf24' : color;
            ctx.shadowBlur = searchQuery && searchMatches ? 20 : 15;
          }

          ctx.fillStyle = color;
          ctx.globalAlpha = dimmed ? (searchQuery ? 0.08 : 0.1) : (searchQuery && searchMatches ? 0.95 : (isHighlighted && !searchQuery ? 0.95 : 0.7));
          ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);
          ctx.strokeStyle = searchQuery && searchMatches ? '#fbbf24' : color;
          ctx.lineWidth = (isHighlighted || (searchQuery && searchMatches)) ? 3 : 1;
          ctx.strokeRect(node.x - size, node.y - size, size * 2, size * 2);

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          // Label
          ctx.globalAlpha = dimmed ? (searchQuery ? 0.08 : 0.1) : (searchQuery && searchMatches ? 1 : (isHighlighted && !searchQuery ? 1 : 0.8));
          ctx.fillStyle = searchQuery && searchMatches ? '#fbbf24' : '#e2e8f0';
          ctx.font = '9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.name.length > 14 ? node.name.slice(0, 14) + '…' : node.name, node.x, node.y + size + 12);
        } else {
          const contribNode = node as ContribNode;
          const size = 6 + (contribNode.contributions / maxContrib) * 12;

          if (isHighlighted && !searchQuery) {
            ctx.shadowColor = '#a78bfa';
            ctx.shadowBlur = 15;
          }

          // Draw avatar circle
          const img = loadImage(contribNode.avatar);
          if ((isHighlighted && !searchQuery) || (searchQuery && searchMatches)) {
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
            ctx.strokeStyle = searchQuery && searchMatches ? '#fbbf24' : (isHighlighted ? '#a78bfa' : '#6366f1');
            ctx.lineWidth = (isHighlighted || (searchQuery && searchMatches)) ? 3 : 1;
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fillStyle = '#a78bfa';
            ctx.globalAlpha = dimmed ? (searchQuery ? 0.08 : 0.1) : (searchQuery && searchMatches ? 0.9 : (isHighlighted ? 0.85 : 0.6));
            ctx.fill();
            ctx.strokeStyle = searchQuery && searchMatches ? '#fbbf24' : (isHighlighted ? '#a78bfa' : '#6366f1');
            ctx.lineWidth = (isHighlighted || (searchQuery && searchMatches)) ? 3 : 1;
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
  }, [nodeCount, edgeCount, searchQuery, isFullscreen]);

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
    e.stopPropagation();
    scrollLockRef.current = true;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(5, prev.zoom * delta)) }));
  }, []);

  const getDistance = (touch1: { clientX: number; clientY: number }, touch2: { clientX: number; clientY: number }): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = touch.clientX - rect.left, sy = touch.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const node = findNodeAt(world.x, world.y);
      if (node) {
        // Select node for dragging on mobile
        selectedRef.current = node;
        setSelectedNode(node);
        hoveredRef.current = node;
        setHoveredNode(node);
        dragRef.current = { nodeId: node.id, panStart: null, isPan: false };
      } else {
        // No node clicked, prepare for panning
        selectedRef.current = null;
        setSelectedNode(null);
        dragRef.current = { nodeId: null, panStart: { x: touch.clientX, y: touch.clientY }, isPan: true };
      }
    } else if (e.touches.length === 2) {
      dragRef.current = { nodeId: null, panStart: null, isPan: false };
      touchStartDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
    }
  }, [screenToWorld, findNodeAt]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const drag = dragRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = touch.clientX - rect.left, sy = touch.clientY - rect.top;
      
      if (drag.nodeId && selectedRef.current) {
        // Drag selected node
        const world = screenToWorld(sx, sy);
        const node = nodesRef.current.get(drag.nodeId);
        if (node) {
          node.x = world.x;
          node.y = world.y;
          node.vx = 0;
          node.vy = 0;
        }
      } else if (drag.isPan && drag.panStart) {
        // Pan canvas
        const dx = touch.clientX - drag.panStart.x;
        const dy = touch.clientY - drag.panStart.y;
        drag.panStart = { x: touch.clientX, y: touch.clientY };
        setCamera(prev => ({ ...prev, x: prev.x + dx / prev.zoom, y: prev.y + dy / prev.zoom }));
      }
    } else if (e.touches.length === 2) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      if (touchStartDistanceRef.current !== null && touchStartDistanceRef.current > 0) {
        const ratio = currentDistance / touchStartDistanceRef.current;
        setCamera(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(5, prev.zoom * (ratio > 1 ? 1.05 : 0.95))) }));
        touchStartDistanceRef.current = currentDistance;
      }
    }
  }, [screenToWorld]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 0) {
      dragRef.current = { nodeId: null, panStart: null, isPan: false };
      touchStartDistanceRef.current = null;
      // Selection persists to keep node highlighted - will deselect on click away
    }
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Click on empty canvas area deselects the node
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    const node = findNodeAt(world.x, world.y);
    
    if (!node && selectedRef.current) {
      // Clicked on empty space, deselect
      selectedRef.current = null;
      setSelectedNode(null);
    }
  }, [screenToWorld, findNodeAt]);

  const resetView = useCallback(() => setCamera({ x: 0, y: 0, zoom: 1 }), []);

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    scrollLockRef.current = true;
    setCamera(p => ({ ...p, zoom: Math.min(5, p.zoom * 1.3) }));
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    scrollLockRef.current = true;
    setCamera(p => ({ ...p, zoom: Math.max(0.1, p.zoom * 0.7) }));
  }, []);

  const handleResetView = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetView();
  }, [resetView]);

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
      // Fullscreen API not supported or permission denied - silently fail
      // User can still use graph, just not fullscreen
    }
  }, [isFullscreen]);

  const handleToggleFullscreen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFullscreen();
  }, [toggleFullscreen]);

  if (isLoading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="animate-pulse">
          <div className="h-6 w-32 shimmer rounded mb-2" />
          <div className="h-4 w-48 shimmer rounded" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-card border border-border rounded-xl p-2 sm:p-4 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="space-y-2"><div className="h-4 w-20 shimmer rounded" /><div className="h-8 w-full shimmer rounded" /></div>))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-card border border-border rounded-xl overflow-hidden relative animate-pulse" style={{ height: 'calc(100vh - 320px)', minHeight: '250px' }}>
          <div className="absolute inset-0 flex items-center justify-center bg-surface-card/50">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full shimmer mx-auto" />
              <div className="h-4 w-40 shimmer rounded mx-auto" />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Network Graph</h2>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
            {nodeCount} nodes · {edgeCount} connections
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={handleZoomIn}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all h-8 w-8 flex items-center justify-center flex-shrink-0" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all h-8 w-8 flex items-center justify-center flex-shrink-0" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleResetView}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all h-8 w-8 flex items-center justify-center flex-shrink-0" title="Reset View">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button onClick={handleToggleFullscreen}
            className="p-2 rounded-lg bg-surface-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all h-8 w-8 flex items-center justify-center flex-shrink-0" title="Fullscreen">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Filters & Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-card border border-border rounded-xl p-2 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {/* Search Bar */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none flex-shrink-0" />
            <Input
              type="text"
              placeholder="Search repos or contributors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-xs sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Min Contributions Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] sm:text-xs font-semibold text-foreground">Min Contrib</label>
              <span className="text-[11px] sm:text-xs text-muted-foreground font-mono">{minContributors}</span>
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
              <label className="text-[11px] sm:text-xs font-semibold text-foreground">Min Repos</label>
              <span className="text-[11px] sm:text-xs text-muted-foreground font-mono">{minRepos}</span>
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
              <label className="text-[11px] sm:text-xs font-semibold text-foreground">Contributors</label>
              <span className="text-[11px] sm:text-xs text-muted-foreground font-mono">{maxContributorsShow}</span>
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
          height: isFullscreen ? '100vh' : screenWidth < 640 ? 'calc(100vh - 120px)' : screenWidth < 768 ? 'calc(100vh - 180px)' : 'calc(100vh - 360px)',
          minHeight: '250px',
          cursor: dragRef.current.nodeId ? 'grabbing' : dragRef.current.isPan ? 'move' : 'default',
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); hoveredRef.current = null; setHoveredNode(null); }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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

        {/* No search results message */}
        {searchQuery && Array.from(nodesRef.current.values()).every(n => !matchesSearch(n)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-card/20 backdrop-blur-sm rounded-xl pointer-events-none">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">No results found for "{searchQuery}"</p>
              <p className="text-xs text-muted-foreground/70">Try a different search term</p>
            </div>
          </div>
        )}

        {/* Bottom legend - stats */}
        <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground bg-surface-card/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border max-w-[calc(100%-2rem)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/70" /> Repos</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary/60" /> Contributors</div>
            <span className="hidden md:inline">Edge width = contributions</span>
            {searchQuery && (
              <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">Filter: "{searchQuery}"</span>
            )}
          </div>
          <div className="text-[9px] text-muted-foreground/70 mt-1.5 md:hidden">
            Drag to pan · Scroll to zoom
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
