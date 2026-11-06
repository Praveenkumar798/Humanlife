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
  Radio,
  Wifi,
  WifiOff,
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
  const [wsStatus, setWsStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Load user conversation list
  const loadConversations = async () => {
    try {
      const list = await api.chat.listConversations();
      setConversations(list || []);
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

  // Establish and maintain WebSocket connection
  const initWebSocket = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWsStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const wsHost = window.location.port === '5173' ? `${host}:8000` : window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws/chat`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketEvent(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Auto-reconnect after 4 seconds if not closed deliberately
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          initWebSocket();
        }, 4000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
        setWsStatus('disconnected');
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket initialization failed:', err);
      setWsStatus('disconnected');
    }
  };

  useEffect(() => {
    initWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle incoming stream events from backend WebSocket
  const handleWebSocketEvent = (data) => {
    if (data.type === 'connected') {
      return;
    }

    if (data.type === 'start') {
      // Append streaming assistant placeholder
      const streamingMsg = {
        id: `streaming-${Date.now()}`,
        role: 'assistant',
        content: '',
        sources: [],
        isStreaming: true,
        conversation_id: data.conversation_id,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, streamingMsg]);
      return;
    }

    if (data.type === 'citations') {
      setMessages((prev) => {
        return prev.map((m) => {
          if (m.isStreaming) {
            return { ...m, sources: data.citations || [] };
          }
          return m;
        });
      });
      return;
    }

    if (data.type === 'chunk') {
      setMessages((prev) => {
        return prev.map((m) => {
          if (m.isStreaming) {
            return { ...m, content: (m.content || '') + (data.text || '') };
          }
          return m;
        });
      });
      return;
    }

    if (data.type === 'done') {
      setMessages((prev) => {
        return prev.map((m) => {
          if (m.isStreaming) {
            return {
              ...m,
              id: data.message_id || m.id,
              content: data.full_text || m.content,
              isStreaming: false,
              is_grounded: data.is_grounded,
            };
          }
          return m;
        });
      });

      if (!activeConvoId && data.conversation_id) {
        setActiveConvoId(data.conversation_id);
        loadConversations();
      }
      setSending(false);
      return;
    }

    if (data.type === 'error') {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${data.error || 'Failed to complete streaming response.'}`,
          isError: true,
        },
      ]);
      setSending(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userText = input.trim();
    setInput('');

    // Optimistically render user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    // Prefer WebSocket real-time token streaming if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'chat',
          message: userText,
          conversation_id: activeConvoId || undefined,
        })
      );
    } else {
      // Graceful REST Fallback
      try {
        const response = await api.chat.send({
          message: userText,
          conversation_id: activeConvoId || undefined,
        });

        if (!activeConvoId) {
          setActiveConvoId(response.conversation_id);
          loadConversations();
        }

        const assistantMsg = {
          id: response.message_id,
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          created_at: response.created_at,
          is_grounded: response.is_grounded,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${err.message || 'Failed to communicate with AI replica.'}`,
            isError: true,
          },
        ]);
      } finally {
        setSending(false);
      }
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
          style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={() => {
            setActiveConvoId(null);
            setMessages([]);
          }}
        >
          <Plus size={16} /> New Conversation
        </button>

        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Recent Conversations
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
              No conversations yet. Start a new chat!
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConvoId;
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setActiveConvoId(c.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <MessageSquare size={14} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </span>
                  </div>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConvoId(c.id);
                    }}
                    title="Delete Conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Stream Status Header */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BrainCircuit size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
              {conversations.find((c) => c.id === activeConvoId)?.title || 'Live Memory Replica'}
            </span>
          </div>

          {/* WebSocket Live Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            {wsStatus === 'connected' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--accent-success)',
                fontWeight: '500',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-success)',
                  boxShadow: '0 0 8px var(--accent-success)',
                  display: 'inline-block',
                }} />
                WebSocket Live Stream
              </span>
            ) : wsStatus === 'connecting' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
                <Radio size={14} /> Connecting Stream...
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--accent-warning)' }}>
                <WifiOff size={14} /> REST Fallback Active
              </span>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {messages.length === 0 && !loadingHistory ? (
            <div style={{
              margin: 'auto',
              maxWidth: '520px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
                Every response is streamed live token-by-token and strictly grounded in your verified archive.
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
            <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                      position: 'relative',
                    }}>
                      {m.content}
                      {m.isStreaming && (
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '14px',
                          backgroundColor: 'var(--accent-primary)',
                          marginLeft: '4px',
                          animation: 'pulse 1s infinite',
                          verticalAlign: 'middle',
                        }} />
                      )}
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

              {sending && !messages.some((m) => m.isStreaming) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Sparkles size={16} color="var(--accent-primary)" />
                  <span>Searching pgvector memories and establishing real-time stream...</span>
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
              style={{
                flex: 1,
                padding: '12px 18px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim() || sending}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
            >
              <Send size={16} /> Send
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteConvoId)}
        title="Delete Conversation"
        message="Are you sure you want to permanently delete this chat session and its full message history?"
        onConfirm={handleDeleteConversation}
        onCancel={() => setDeleteConvoId(null)}
      />
    </div>
  );
}
