import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  MessageSquare,
  Upload,
  Mic,
  PlusCircle,
  Clock,
  CheckCircle,
  FileText,
  ArrowRight,
  Sparkles,
  BrainCircuit,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage({ onNavigate }) {
  const { user } = useAuth();
  const [totalMemories, setTotalMemories] = useState(0);
  const [recentMemories, setRecentMemories] = useState([]);
  const [recentConversations, setRecentConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch real memories count and recent list
      const memData = await api.memories.list({ page: 1, page_size: 5 });
      setTotalMemories(memData.total);
      setRecentMemories(memData.items || []);

      // Fetch conversations list
      const convos = await api.chat.listConversations();
      setRecentConversations((convos || []).slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Unable to load some archive statistics. Please verify backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="page-wrapper">
      {/* Hero Welcome Banner with Holographic Cognitive Status */}
      <div
        className="card"
        style={{
          padding: '36px 32px',
          marginBottom: '32px',
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.85) 60%, rgba(19, 78, 74, 0.3) 100%)',
          border: '1px solid rgba(129, 140, 248, 0.3)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '640px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '9999px', background: 'rgba(99, 102, 241, 0.18)', border: '1px solid rgba(99, 102, 241, 0.35)', marginBottom: '14px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981', display: 'inline-block' }}></span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#a5b4fc', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Cognitive Replica Online
            </span>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.8px', color: '#fff', marginBottom: '10px' }}>
            Welcome back, <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{user?.full_name || user?.username}</span>
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6' }}>
            Your personal memories, core values, and life decisions are safely preserved in our pgvector neural vault with Gemini real-time grounding.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '22px' }}>
            <button
              className="btn btn-primary"
              onClick={() => onNavigate('voice')}
              style={{ padding: '12px 22px', fontSize: '14px' }}
            >
              <Mic size={18} /> Talk with Replica
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('biographer')}
              style={{ padding: '12px 22px', fontSize: '14px', background: 'rgba(99, 102, 241, 0.25)', border: '1px solid rgba(129, 140, 248, 0.4)', color: '#fff' }}
            >
              <Sparkles size={18} color="#c084fc" /> AI Biographer Interview
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('library')}
              style={{ padding: '12px 22px', fontSize: '14px' }}
            >
              <PlusCircle size={18} /> Add New Memory
            </button>
          </div>
        </div>

        {/* Neural Stats Box */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '18px',
            padding: '20px 26px',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            gap: '24px',
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#38bdf8' }}>{totalMemories}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Indexed Memories</div>
          </div>
          <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}></div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#a855f7' }}>768-D</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Vector Embeddings</div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Quick Action Cards */}
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        <div
          className="card"
          onClick={() => onNavigate('voice')}
          style={{ cursor: 'pointer', border: '1px solid rgba(168, 85, 247, 0.25)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)',
            }}>
              <Mic size={24} />
            </div>
            <span className="badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              ⚡ Real-Time Live
            </span>
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Voice Assistant</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Real-time vocal conversation powered by Gemini Live Multimodal API with hands-free VAD and wave visualizer.
          </p>
        </div>

        <div
          className="card"
          onClick={() => onNavigate('chat')}
          style={{ cursor: 'pointer', border: '1px solid rgba(16, 185, 129, 0.25)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            }}>
              <MessageSquare size={24} />
            </div>
            <span className="badge badge-success">RAG Grounded</span>
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Ask AI Replica</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Query decisions, values, or memories with token-by-token live streaming and verified source citations.
          </p>
        </div>

        <div
          className="card"
          onClick={() => onNavigate('upload')}
          style={{ cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.25)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)',
            }}>
              <Upload size={24} />
            </div>
            <span className="badge badge-info">PDF & TXT</span>
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Upload Journal</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Ingest personal diaries, memoirs, letters, or PDF records into semantic vector chunks automatically.
          </p>
        </div>
      </div>

      {/* Main Stats and Recent Activity */}
      <div className="grid-2">
        {/* Recent Memories */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={20} color="#818cf8" />
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#fff' }}>Stored Memories ({totalMemories})</h3>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('library')}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading memory archive...</p>
          ) : recentMemories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-muted)' }}>
              <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px', marginBottom: '14px' }}>No memories recorded yet.</p>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('library')}>
                <PlusCircle size={14} /> Add First Memory
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentMemories.map((mem) => (
                <div
                  key={mem.id}
                  onClick={() => onNavigate('memory-detail', { memoryId: mem.id })}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                    e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{mem.title}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {mem.category || 'General'} • {new Date(mem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    {mem.verification_status || 'unverified'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Conversations */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={20} color="#34d399" />
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#fff' }}>Conversations ({recentConversations.length})</h3>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('chat')}
            >
              Open Chat <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading conversations...</p>
          ) : recentConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-muted)' }}>
              <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px', marginBottom: '14px' }}>No chat conversations yet.</p>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('chat')}>
                <MessageSquare size={14} /> Start First Chat
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentConversations.map((convo) => (
                <div
                  key={convo.id}
                  onClick={() => onNavigate('chat', { conversationId: convo.id })}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                    e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
                  }}
                >
                  <div style={{ overflow: 'hidden', paddingRight: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {convo.title}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {convo.message_count || 0} messages • {new Date(convo.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
