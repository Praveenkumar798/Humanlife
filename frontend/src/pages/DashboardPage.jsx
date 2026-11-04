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
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>
          Welcome back, {user?.full_name || user?.username}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Your personal cognitive preservation archive is active and protected.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Quick Action Cards */}
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        <div
          className="card"
          onClick={() => onNavigate('upload')}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s ease', border: '1px solid var(--border-color)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Upload size={22} />
            </div>
            <span className="badge badge-info">PDF & TXT</span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Upload Document</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Extract and chunk life journals, letters, or PDF documents into vector embeddings.
          </p>
        </div>

        <div
          className="card"
          onClick={() => onNavigate('chat')}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s ease', border: '1px solid var(--border-color)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)'
            }}>
              <MessageSquare size={22} />
            </div>
            <span className="badge badge-success">RAG Grounded</span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Ask AI Replica</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Ask questions about past decisions, values, or memories with strict source citations.
          </p>
        </div>

        <div
          className="card"
          onClick={() => onNavigate('voice')}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s ease', border: '1px solid var(--border-color)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a855f7'
            }}>
              <Mic size={22} />
            </div>
            <span className="badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>Live Audio</span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Voice Assistant</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Real-time vocal conversation powered by Gemini Live API with automatic fallback.
          </p>
        </div>
      </div>

      {/* Main Stats and Recent Activity */}
      <div className="grid-2">
        {/* Recent Memories */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Stored Memories ({totalMemories})</h3>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('library')}
            >
              View Library <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading memory archive...</p>
          ) : recentMemories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px', marginBottom: '12px' }}>No memories recorded yet.</p>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('library')}>
                <PlusCircle size={14} /> Add First Memory
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentMemories.map((mem) => (
                <div
                  key={mem.id}
                  onClick={() => onNavigate('memory-detail', { memoryId: mem.id })}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{mem.title}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {mem.category || 'General'} • {new Date(mem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    {mem.memory_type || 'episodic'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Conversations */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--success)" />
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Recent Conversations</h3>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('chat')}
            >
              Start New Chat <PlusCircle size={14} />
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading conversation history...</p>
          ) : recentConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <MessageSquare size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px', marginBottom: '12px' }}>No chat conversations yet.</p>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('chat')}>
                Start First Conversation
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentConversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onNavigate('chat', { conversationId: c.id })}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.title}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(c.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="badge badge-info">
                    {c.message_count || 0} msgs
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
