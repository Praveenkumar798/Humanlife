import React, { useEffect, useRef, useState } from 'react';
import { BrainCircuit, Sparkles, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';

export default function NeuralMindMapView({ memories, onOpenMemory }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const animFrameIdRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragTargetRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Build cluster graph from memories
  useEffect(() => {
    const width = 820;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodes = [];
    const links = [];

    // 1. Center Core Identity Node
    nodes.push({
      id: 'core',
      label: 'Core Legacy',
      type: 'core',
      x: centerX,
      y: centerY,
      radius: 36,
      color: '#6366f1',
      glow: 'rgba(99, 102, 241, 0.6)',
      vx: 0,
      vy: 0,
    });

    // 2. Extract unique categories as Hub Nodes
    const categories = Array.from(new Set(memories.map((m) => m.category || 'General')));
    const categoryColors = {
      'Personal Reflection': '#a855f7',
      'Family & Relationships': '#ec4899',
      'Career & Work': '#3b82f6',
      'Values & Philosophy': '#10b981',
      'Childhood': '#f59e0b',
      'Education': '#06b6d4',
      'General': '#818cf8',
    };

    categories.forEach((cat, idx) => {
      const angle = (idx / categories.length) * 2 * Math.PI;
      const hubDist = 140;
      const hubX = centerX + Math.cos(angle) * hubDist;
      const hubY = centerY + Math.sin(angle) * hubDist;
      const color = categoryColors[cat] || '#818cf8';

      const hubId = `cat-${cat}`;
      nodes.push({
        id: hubId,
        label: cat,
        type: 'category',
        x: hubX,
        y: hubY,
        radius: 26,
        color,
        glow: `${color}88`,
        vx: 0,
        vy: 0,
      });

      links.push({
        source: 'core',
        target: hubId,
        color: 'rgba(129, 140, 248, 0.35)',
        width: 2,
      });
    });

    // 3. Add Memory Leaf Nodes
    memories.forEach((m, idx) => {
      const cat = m.category || 'General';
      const hubId = `cat-${cat}`;
      const parentHub = nodes.find((n) => n.id === hubId);
      const angle = (idx * 1.6) + Math.random();
      const leafDist = 90 + (idx % 3) * 20;

      const leafX = (parentHub ? parentHub.x : centerX) + Math.cos(angle) * leafDist;
      const leafY = (parentHub ? parentHub.y : centerY) + Math.sin(angle) * leafDist;
      const color = categoryColors[cat] || '#38bdf8';

      const leafId = `mem-${m.id}`;
      nodes.push({
        id: leafId,
        memoryId: m.id,
        label: m.title.length > 20 ? m.title.slice(0, 18) + '...' : m.title,
        fullTitle: m.title,
        content: m.content,
        type: 'memory',
        x: leafX,
        y: leafY,
        radius: 18,
        color,
        glow: `${color}99`,
        vx: 0,
        vy: 0,
      });

      links.push({
        source: hubId,
        target: leafId,
        color: `${color}44`,
        width: 1.5,
      });
    });

    nodesRef.current = nodes;
    linksRef.current = links;
  }, [memories]);

  // Main 60fps Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = 820;
    const height = 520;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let pulseTime = 0;

    const render = () => {
      animFrameIdRef.current = requestAnimationFrame(render);
      pulseTime += 0.03;

      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const links = linksRef.current;

      // Draw Neural Links & Synapse pulses
      links.forEach((link) => {
        const sourceNode = nodes.find((n) => n.id === link.source);
        const targetNode = nodes.find((n) => n.id === link.target);
        if (!sourceNode || !targetNode) return;

        // Line
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = link.color;
        ctx.lineWidth = link.width;
        ctx.stroke();

        // Animated Synapse Energy Particle
        const progress = (pulseTime * 0.5 + (sourceNode.x % 1)) % 1;
        const px = sourceNode.x + (targetNode.x - sourceNode.x) * progress;
        const py = sourceNode.y + (targetNode.y - sourceNode.y) * progress;

        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#38bdf8';
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Nodes
      nodes.forEach((node) => {
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const pulse = Math.sin(pulseTime * 2) * (node.type === 'core' ? 3 : 1.5);
        const currentRadius = node.radius + (isHovered ? 4 : 0) + (node.type === 'core' ? pulse : 0);

        // Outer Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentRadius + 6, 0, 2 * Math.PI);
        ctx.fillStyle = node.glow;
        ctx.shadowBlur = 16;
        ctx.shadowColor = node.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentRadius, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isHovered ? 2.5 : 1;
        ctx.stroke();

        // Node Label
        ctx.fillStyle = '#ffffff';
        ctx.font = node.type === 'core' ? 'bold 12px "Plus Jakarta Sans"' : '10px "Plus Jakarta Sans"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (node.type === 'core') {
          ctx.fillText('🧠 Core', node.x, node.y);
        } else {
          ctx.fillText(node.label, node.x, node.y + node.radius + 12);
        }
      });
    };

    render();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [hoveredNode]);

  // Mouse Interaction handlers (Drag & Hover)
  const getCanvasMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 820 / rect.width;
    const scaleY = 520 / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseMove = (e) => {
    const pos = getCanvasMousePos(e);
    mousePosRef.current = pos;

    if (isDraggingRef.current && dragTargetRef.current) {
      dragTargetRef.current.x = pos.x;
      dragTargetRef.current.y = pos.y;
      return;
    }

    const hit = nodesRef.current.find((n) => {
      const dx = n.x - pos.x;
      const dy = n.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });

    setHoveredNode(hit || null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? 'pointer' : 'default';
    }
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasMousePos(e);
    const hit = nodesRef.current.find((n) => {
      const dx = n.x - pos.x;
      const dy = n.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });

    if (hit) {
      isDraggingRef.current = true;
      dragTargetRef.current = hit;
      setSelectedNode(hit);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragTargetRef.current = null;
  };

  const handleClick = (e) => {
    const pos = getCanvasMousePos(e);
    const hit = nodesRef.current.find((n) => {
      const dx = n.x - pos.x;
      const dy = n.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });

    if (hit && hit.type === 'memory' && hit.memoryId) {
      onOpenMemory(hit.memoryId);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '820px', margin: '0 auto' }}>
      {/* Mind Map Canvas Container */}
      <div
        className="card"
        style={{
          padding: '12px',
          background: 'radial-gradient(circle at 50% 50%, rgba(30, 27, 75, 0.7) 0%, rgba(7, 10, 19, 0.95) 100%)',
          border: '1px solid rgba(129, 140, 248, 0.3)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: '20px', left: '24px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BrainCircuit size={14} /> Interactive Neural Map
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Click node to view memory • Drag to rearrange
          </span>
        </div>

        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          style={{ width: '100%', height: '520px', display: 'block', borderRadius: '12px' }}
        />

        {/* Node Hover Tooltip Card */}
        {hoveredNode && hoveredNode.type === 'memory' && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              right: '24px',
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(16px)',
              border: '1px solid #818cf8',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>
                {hoveredNode.fullTitle}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', lineClamp: 1, overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '580px' }}>
                {hoveredNode.content}
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onOpenMemory(hoveredNode.memoryId)}
              style={{ flexShrink: 0 }}
            >
              Open Memory
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
