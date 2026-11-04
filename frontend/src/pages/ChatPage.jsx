import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Plus,
  Trash2,
  BrainCircuit,
  MessageSquare,
  Sparkles,
  BookMarked,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import CitationCard from '../components/CitationCard';
import ConfirmModal from '../components/ConfirmModal';

export default function ChatPage({ initialConversationId, onNavigate }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState(initialConversationId || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deleteConvoId, setDeleteConvoId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load user conversation list
  const loadConversations = async () => {
    try {
      const list = await api.chat.listConversations();
      setConversations(list || []);
      if (!activeConvoId && list && list.length > 0) {
        // Don't auto-select unless user wants to
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Load message history when activeConvoId changes
  useEffect(() => {
    if (activeConvoId) {
      const loadMessages = async () => {
        try {
          setLoadingHistory(true);
          const detail = await api.chat.getConversation(activeConvoId);
          setMessages(detail.messages || []);
        } catch (err) {
          console.error('Failed to load conversation history:', err);
        } finally {
          setLoadingHistory(false);
        }
      };
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [activeConvoId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userText = input.trim();
    setInput('');

    // Optimistically append user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    try {
      const response = await api.chat.send({
        message: userText,
        conversation_id: activeConvoId || undefined,
      });

      // If this was a new conversation, update active ID and refresh list
      if (!activeConvoId) {
        setActiveConvoId(response.conversation_id);
        loadConversations();
      }

      // Append assistant message
      const assistantMsg = {
        id: response.message_id,
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        created_at: response.created_at,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      // Append error message
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response from AI replica.'}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!deleteConvoId) return;
    try {
      await api.chat.deleteConversation(deleteConvoId);
      if (activeConvoId === deleteConvoId) {
        setActiveConvoId(null);
        setMessages([]);
      }
      setDeleteConvoId(null);
      loadConversations();
    } catch (err) {
      alert(err.message || 'Failed to delete conversation.');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sessions Sidebar */}
      <div style={{
        width: '280px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        flexShrink: 0,
      }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '16px' }}
          onClick={() => {
            setActiveConvoId(null);
            setMessages([]);
          }}
        >
          <Plus size={16} /> New Conversation
        </button>

        <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
          Recent Sessions
        </h4>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {conversations.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
              No conversations yet.
            </p>
          ) : (
            conversations.map((c) => {
              const isActive = activeConvoId === c.id;
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                    border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveConvoId(c.id)}
                >
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: isActive ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(c.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConvoId(c.id);
                    }}
                    title="Delete conversation"
                    style={{ color: 'var(--text-muted)', padding: '4px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)' }}>
        {/* Messages Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', maxWidth: '540px', margin: '80px auto', color: 'var(--text-secondary)' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <BrainCircuit size={30} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Human Legacy AI Replica
              </h2>
              <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                Ask anything about your stored life memories, childhood experiences, decisions, career lessons, or principles.
                Every response is strictly grounded in your verified archive.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                <button
                  className="card"
                  style={{ padding: '12px 16px', fontSize: '13px', cursor: 'pointer' }}
                  onClick={() => setInput("What was my earliest documented childhood memory?")}
                >
                  💬 "What was my earliest documented childhood memory?"
                </button>
                <button
                  className="card"
                  style={{ padding: '12px 16px', fontSize: '13px', cursor: 'pointer' }}
                  onClick={() => setInput("What are my core principles when making difficult decisions?")}
                >
                  💬 "What are my core principles when making difficult decisions?"
                </button>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isUser ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      color: '#ffffff',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      border: isUser ? 'none' : '1px solid var(--border-color)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {m.content}
                    </div>

                    {/* Citations Panel */}
                    {!isUser && m.sources && m.sources.length > 0 && (
                      <div style={{ width: '100%', maxWidth: '85%', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          <BookMarked size={14} /> Grounded Sources ({m.sources.length})
                        </div>
                        {m.sources.map((cit, idx) => (
                          <CitationCard
                            key={idx}
                            citation={cit}
                            onOpenMemory={(memId) => onNavigate('memory-detail', { memoryId: memId })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Sparkles size={16} color="var(--accent-primary)" />
                  <span>Searching pgvector memories and synthesizing answer...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '16px 32px 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
        }}>
          <form
            onSubmit={handleSend}
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              display: 'flex',
              gap: '12px',
            }}
          >
            <input
              type="text"
              placeholder="Ask your memory replica a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              style={{ flex: 1, padding: '14px 16px', fontSize: '15px' }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || !input.trim()}
              style={{ padding: '0 24px' }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteConvoId !== null}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation session? All message history will be removed."
        onConfirm={handleDeleteConversation}
        onCancel={() => setDeleteConvoId(null)}
      />
    </div>
  );
}

