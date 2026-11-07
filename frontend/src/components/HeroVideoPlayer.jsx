import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Sparkles, BrainCircuit, Globe2, Radio } from 'lucide-react';

export default function HeroVideoPlayer({ onGetStarted }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('te');
  const [currentTime, setCurrentTime] = useState(12);
  const canvasRef = useRef(null);

  const demoSubtitles = {
    te: {
      title: 'తెలుగు వాయిస్ రెప్లికా లైవ్ డెమో (Telugu Cognitive Replica)',
      quote: '“1998 లో నేను హైదరాబాద్ వచ్చినప్పుడు నా చేతిలో ఒక్క బ్యాగ్ తప్ప ఏమీ లేదు... కానీ ఆ రోజుల్లో పడ్డ కష్టమే ఈ రోజు నా కుటుంబానికి పునాది.”',
      timecode: '00:18 / 01:00',
      badge: 'GEMINI LIVE TELUGU STREAM'
    },
    hi: {
      title: 'हिन्दी वॉइस रेप्लिका लाइव डेमो (Hindi Cognitive Replica)',
      quote: '“2005 में जब मैंने सरकारी नौकरी छोड़कर बिज़नेस शुरू किया, तब सबने मना किया था... लेकिन खुद पर भरोसा रखना ही सबसे बड़ा सबक था।”',
      timecode: '00:24 / 01:00',
      badge: 'GEMINI LIVE HINDI STREAM'
    },
    en: {
      title: 'English Cognitive Replica Live Demo',
      quote: '“Always lead by empathy before discipline. My children learned not from what I preached, but from how I treated everyday people with kindness.”',
      timecode: '00:32 / 01:00',
      badge: 'GEMINI LIVE MULTIMODAL'
    }
  };

  // 3D Animated AI Holographic Core on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let angle = 0;

    const width = (canvas.width = 640);
    const height = (canvas.height = 360);

    // Generate 3D sphere points (AI brain representation)
    const points = [];
    const pointCount = 140;
    const radius = 100;

    for (let i = 0; i < pointCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / pointCount);
      const theta = Math.sqrt(pointCount * Math.PI) * phi;
      points.push({
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi),
      });
    }

    const render = () => {
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, width, height);

      // Subtle background scanlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (isPlaying) {
        angle += 0.015;
      }

      const cx = width / 2;
      const cy = height / 2 - 10;
      const fov = 350;

      // Project and rotate 3D points
      const projected = points.map((p) => {
        // Rotate around Y and X axes
        const radY = angle;
        const radX = angle * 0.6;

        let x1 = p.x * Math.cos(radY) - p.z * Math.sin(radY);
        let z1 = p.z * Math.cos(radY) + p.x * Math.sin(radY);

        let y1 = p.y * Math.cos(radX) - z1 * Math.sin(radX);
        let z2 = z1 * Math.cos(radX) + p.y * Math.sin(radX);

        const scale = fov / (fov + z2 + 180);
        return {
          x: cx + x1 * scale,
          y: cy + y1 * scale,
          scale: scale,
          z: z2,
        };
      });

      // Draw connective neural synapses
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 42) {
            const alpha = (1 - dist / 42) * 0.35;
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw glowing nodes
      projected.sort((a, b) => a.z - b.z);
      projected.forEach((p) => {
        const size = Math.max(1, p.scale * 3);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 2.5);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(0.5, '#6366f1');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      });

      // Soundwave Ring Pulse at bottom
      const ringRadius = 130 + Math.sin(angle * 4) * 8;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 95, ringRadius, ringRadius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  return (
    <div style={{
      width: '100%',
      maxWidth: '880px',
      margin: '0 auto',
      position: 'relative',
      borderRadius: '24px',
      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
      border: '1.5px solid rgba(99, 102, 241, 0.35)',
      boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(99, 102, 241, 0.25)',
      overflow: 'hidden',
    }}>
      {/* Top Header of Video Player */}
      <div style={{
        padding: '12px 20px',
        background: 'rgba(0, 0, 0, 0.4)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '10px',
            fontWeight: '800',
            padding: '3px 8px',
            borderRadius: '9999px',
            letterSpacing: '0.5px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#fff', animation: 'pulse 1s infinite' }} />
            LIVE VIDEO MOTION
          </span>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {demoSubtitles[selectedLanguage].title}
          </span>
        </div>

        {/* Language Selection inside Video */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['te', 'hi', 'en'].map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                border: '1px solid',
                borderColor: selectedLanguage === lang ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                backgroundColor: selectedLanguage === lang ? 'var(--accent-primary)' : 'rgba(0, 0, 0, 0.3)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {lang === 'te' ? 'తెలుగు' : lang === 'hi' ? 'हिन्दी' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Video Canvas Screen (16:9) */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Holographic Watermark Badge */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '11px',
          color: '#38bdf8',
          fontWeight: '700'
        }}>
          <Radio size={14} color="#38bdf8" />
          <span>{demoSubtitles[selectedLanguage].badge}</span>
        </div>

        {/* Resolution Badge */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(8px)',
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '10px',
          color: '#a5b4fc',
          fontWeight: '800'
        }}>
          4K 60FPS AI STREAM
        </div>

        {/* Live Subtitle Overlay Box */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          right: '20px',
          background: 'rgba(7, 10, 19, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '14px',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#818cf8', fontWeight: '800', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BrainCircuit size={12} color="#818cf8" />
              <span>COGNITIVE REPLICA SPOKEN AUDIO</span>
            </div>
            <p style={{
              fontSize: 'clamp(12px, 1.6vw, 14px)',
              color: '#f8fafc',
              fontWeight: '500',
              lineHeight: '1.4',
              margin: 0
            }}>
              {demoSubtitles[selectedLanguage].quote}
            </p>
          </div>

          {/* Equalizer Frequency Bars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            {[10, 24, 16, 32, 14, 28, 18, 30].map((h, i) => (
              <span
                key={i}
                style={{
                  width: '3px',
                  height: isPlaying ? `${h}px` : '4px',
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: '2px',
                  transition: 'height 0.15s ease',
                  animation: isPlaying ? `audioBarWave 0.7s ease-in-out infinite ${i * 0.08}s` : 'none'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Video Player Bottom Controls Bar */}
      <div style={{
        padding: '12px 20px',
        background: 'rgba(0, 0, 0, 0.6)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        {/* Play/Pause Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.5)'
            }}
          >
            {isPlaying ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" />}
          </button>

          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {demoSubtitles[selectedLanguage].timecode}
          </span>
        </div>

        {/* Video Scrubber Bar */}
        <div style={{
          flex: 1,
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '9999px',
          position: 'relative',
          cursor: 'pointer'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: isPlaying ? '45%' : '20%',
            height: '100%',
            backgroundColor: 'var(--accent-primary)',
            borderRadius: '9999px',
            boxShadow: '0 0 10px var(--accent-primary)'
          }} />
        </div>

        {/* Right CTA */}
        <button
          type="button"
          onClick={onGetStarted}
          className="btn btn-primary"
          style={{
            fontSize: '12px',
            padding: '6px 16px',
            borderRadius: '9999px',
            fontWeight: '700'
          }}
        >
          Try Live Replica
        </button>
      </div>
    </div>
  );
}

