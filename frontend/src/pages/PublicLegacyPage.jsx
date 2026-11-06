import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Calendar,
  Sparkles,
  MessageSquare,
  Send,
  BookOpen,
  Download,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
  Clock,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';

export default function PublicLegacyPage({ shareToken }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Guest Chat State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef(null);

  // Load public profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await api.family.getPublicProfile(shareToken);
        setProfile(data);

        // Initial welcome message from author's replica
        setMessages([
          {
            role: 'assistant',
            content: `Welcome to my memory archive. I am the cognitive replica of ${data.author_name}. Ask me about my life, family moments, turning points, or core values.`,
            citations: [],
          },
        ]);
      } catch (err) {
        setError(err.message || 'Unable to load family legacy. The link may have expired or been deactivated.');
      } finally {
        setLoading(false);
      }
    };

    if (shareToken) {
      fetchProfile();
    }
  }, [shareToken]);

  // Handle Guest Chat
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const userQ = inputValue.trim();
    setInputValue('');

    const newHistory = [...messages, { role: 'user', content: userQ }];
    setMessages(newHistory);
    setSending(true);

    try {
      const res = await api.family.publicChat(shareToken, {
        question: userQ,
        history: newHistory.map((m) => ({ role: m.role, content: m.content })),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          citations: res.citations || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I'm sorry, I could not complete that query: ${err.message}`,
          citations: [],
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617', color: '#94a3b8' }}>
        <RefreshCw size={36} className="spin" color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Opening Family Legacy Vault...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617', padding: '20px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '480px', padding: '40px 28px', borderRadius: '20px' }}>
          <Shield size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginBottom: '10px' }}>
            Portal Inactive or Link Expired
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            {error || 'This family tribute link is no longer available. Please request an updated share link from the author.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: '#f8fafc', paddingBottom: '80px' }}>
      {/* Top Banner */}
      <header
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(20px)',
          padding: '24px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '0.8px', marginBottom: '4px' }}>
              <Heart size={12} fill="#38bdf8" /> Family Heirloom Tribute
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', margin: 0, letterSpacing: '-0.4px' }}>
              The Living Legacy of {profile.author_name}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="badge badge-info" style={{ fontSize: '12px' }}>
              {profile.total_memories} Chapters Preserved
            </span>
          </div>
        </div>
      </header>

      {/* Main Content: Timeline on Left, Replica Chat on Right */}
      <div style={{ maxWidth: '1100px', margin: '32px auto 0', padding: '0 20px' }}>
        <div className="grid-2" style={{ gap: '32px', alignItems: 'start' }}>
          {/* Left: Life Milestones Timeline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="var(--accent-primary)" /> Life Milestones & Memories
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {profile.memories.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className="card"
                  style={{
                    padding: '22px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span className="badge badge-info" style={{ fontSize: '11px' }}>
                      {m.category || 'Memory'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '600' }}>
                      {m.event_date || 'Milestone'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '10px' }}>
                    {m.title}
                  </h3>

                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                    {m.content}
                  </p>

                  {m.tags && m.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '14px' }}>
                      {m.tags.slice(0, 4).map((t, tIdx) => (
                        <span key={tIdx} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Talk with Cognitive Replica */}
          <div style={{ position: 'sticky', top: '100px' }}>
            <div
              className="card"
              style={{
                borderRadius: '20px',
                padding: '24px',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
                border: '1px solid rgba(129, 140, 248, 0.35)',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                height: '560px',
              }}
            >
              {/* Chat Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>
                    Talk with {profile.author_name}'s Replica
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Grounded in True Memories
                  </div>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px' }}>
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={idx}
                      style={{
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        padding: '12px 16px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        backgroundColor: isUser ? 'var(--accent-primary)' : 'rgba(15, 23, 42, 0.8)',
                        border: isUser ? 'none' : '1px solid var(--border-color)',
                        color: '#fff',
                        fontSize: '13px',
                        lineHeight: '1.6',
                      }}
                    >
                      <div>{msg.content}</div>
                      {msg.citations && msg.citations.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '10.5px', color: '#38bdf8' }}>
                          Grounded in: {msg.citations.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sending && (
                  <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Thinking and searching memories...
                  </div>
                )}
                <div ref={chatScrollRef} />
              </div>

              {/* Input Form */}
              {profile.allow_chat ? (
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Ask about ${profile.author_name}'s life...`}
                    disabled={sending}
                    style={{ flex: 1, padding: '12px 14px', borderRadius: '12px', backgroundColor: 'rgba(2, 6, 23, 0.7)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sending || !inputValue.trim()}
                    style={{ padding: '0 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Send size={15} />
                  </button>
                </form>
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  Interactive chat is paused by the author.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
