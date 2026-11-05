import React, { useEffect, useRef } from 'react';

/**
 * AudioWaveformVisualizer
 * High-performance 60fps dynamic audio canvas visualizer.
 * Renders real-time frequency bars with glowing gradient based on Web Audio AnalyserNode.
 */
export default function AudioWaveformVisualizer({
  analyserNode,
  voiceState = 'idle',
  width = 380,
  height = 70,
}) {
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);
    let idleAngle = 0;

    const render = () => {
      animFrameIdRef.current = requestAnimationFrame(render);

      ctx.clearRect(0, 0, width, height);

      const barCount = 28;
      const barWidth = 6;
      const barSpacing = (width - barCount * barWidth) / (barCount - 1);

      // Color scheme according to state
      let primaryColor = '#3b82f6';
      let secondaryColor = '#1d4ed8';
      let glowColor = 'rgba(59, 130, 246, 0.4)';

      if (voiceState === 'listening') {
        primaryColor = '#10b981';
        secondaryColor = '#059669';
        glowColor = 'rgba(16, 185, 129, 0.5)';
      } else if (voiceState === 'speaking') {
        primaryColor = '#c084fc';
        secondaryColor = '#9333ea';
        glowColor = 'rgba(192, 132, 252, 0.5)';
      } else if (voiceState === 'processing') {
        primaryColor = '#38bdf8';
        secondaryColor = '#0284c7';
        glowColor = 'rgba(56, 189, 248, 0.5)';
      }

      if (analyserNode && (voiceState === 'listening' || voiceState === 'speaking')) {
        analyserNode.getByteFrequencyData(dataArray);

        // Step through frequencies across the spectrum
        const step = Math.floor(bufferLength / barCount) || 1;

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i * step] || 0;
          const percent = val / 255;
          const barHeight = Math.max(6, percent * (height - 10));
          const x = i * (barWidth + barSpacing);
          const y = (height - barHeight) / 2;

          const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
          gradient.addColorStop(0, primaryColor);
          gradient.addColorStop(1, secondaryColor);

          ctx.shadowBlur = 8;
          ctx.shadowColor = glowColor;

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
      } else {
        // Idle / Processing simulated gentle breathing wave
        idleAngle += 0.05;
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(idleAngle + (i * 0.35));
          const factor = (wave + 1) / 2;
          const baseHeight = voiceState === 'processing' ? 18 : 6;
          const barHeight = baseHeight + factor * (voiceState === 'processing' ? 24 : 12);
          const x = i * (barWidth + barSpacing);
          const y = (height - barHeight) / 2;

          ctx.shadowBlur = 4;
          ctx.shadowColor = glowColor;
          ctx.fillStyle = primaryColor;
          ctx.globalAlpha = 0.6 + factor * 0.4;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      }
    };

    render();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [analyserNode, voiceState, width, height]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 12px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        margin: '12px auto',
        maxWidth: `${width}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: 'block',
        }}
      />
    </div>
  );
}

