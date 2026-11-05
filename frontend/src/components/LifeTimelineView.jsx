import React from 'react';
import { Calendar, Star, ArrowRight, Sparkles, BookMarked, Tag } from 'lucide-react';

export default function LifeTimelineView({ memories, onOpenMemory }) {
  // Sort memories chronologically by event_date (or created_at fallback)
  const sortedMemories = [...memories].sort((a, b) => {
    const dateA = new Date(a.event_date || a.created_at);
    const dateB = new Date(b.event_date || b.created_at);
    return dateB - dateA; // Newest first
  });

  if (sortedMemories.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
          No Timeline Events Found
        </h3>
        <p style={{ fontSize: '14px' }}>
          Record memories with event dates to visualize your life milestones here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', padding: '20px 0', maxWidth: '850px', margin: '0 auto' }}>
      {/* Central Glowing Timeline Spine */}
      <div
        style={{
          position: 'absolute',
          top: '30px',
          bottom: '30px',
          left: '50%',
          width: '3px',
          background: 'linear-gradient(180deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
          boxShadow: '0 0 15px rgba(129, 140, 248, 0.4)',
          transform: 'translateX(-50%)',
          zIndex: 1,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', position: 'relative', zIndex: 2 }}>
        {sortedMemories.map((m, index) => {
          const isEven = index % 2 === 0;
          const displayDate = m.event_date
            ? new Date(m.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : new Date(m.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

          const year = m.event_date
            ? new Date(m.event_date).getFullYear()
            : new Date(m.created_at).getFullYear();

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isEven ? 'flex-start' : 'flex-end',
                position: 'relative',
                width: '100%',
              }}
            >
              {/* Central Glowing Node Milestone Orb */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--bg-primary)',
                  border: '3px solid #818cf8',
                  boxShadow: '0 0 14px #818cf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 3,
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
              </div>

              {/* Milestone Card */}
              <div
                onClick={() => onOpenMemory(m.id)}
                className="card"
                style={{
                  width: 'calc(50% - 36px)',
                  padding: '20px 22px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: '1px solid rgba(129, 140, 248, 0.25)',
                  boxShadow: '0 12px 28px -8px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.1)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = isEven ? 'translateX(-4px)' : 'translateX(4px)';
                  e.currentTarget.style.borderColor = '#818cf8';
                  e.currentTarget.style.boxShadow = '0 16px 36px -8px rgba(99, 102, 241, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.25)';
                  e.currentTarget.style.boxShadow = '0 12px 28px -8px rgba(0, 0, 0, 0.5)';
                }}
              >
                {/* Milestone Date Tag & Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#38bdf8' }}>
                    <Calendar size={14} />
                    <span>{displayDate}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {m.source_type === 'photo' && (
                      <span className="badge badge-primary" style={{ fontSize: '10px', background: 'rgba(192, 132, 252, 0.2)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.4)' }}>
                        📷 Photo
                      </span>
                    )}
                    <span className="badge badge-info" style={{ fontSize: '11px', padding: '3px 9px' }}>
                      {m.category || 'Memory'}
                    </span>
                  </div>
                </div>

                {/* Milestone Title */}
                <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginBottom: '8px', letterSpacing: '-0.3px' }}>
                  {m.title}
                </h4>

                {/* Content Snippet */}
                <p style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  marginBottom: '14px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {m.content}
                </p>

                {/* Footer metadata */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#fbbf24', fontWeight: '600' }}>
                    <Star size={13} fill="#fbbf24" />
                    <span>{m.importance ? `${m.importance}/10` : 'Milestone'}</span>
                  </div>

                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    View Memory <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

