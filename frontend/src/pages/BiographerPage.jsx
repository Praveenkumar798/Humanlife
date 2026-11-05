import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Shuffle,
  ChevronRight,
  BookOpen,
  CheckCircle,
  Clock,
  Star,
  Tag,
  Calendar,
  Layers,
  ArrowRight,
  Heart,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import { api } from '../services/api';

const ERA_LIST = [
  { id: 'all', label: 'All Chapters', icon: '🌟' },
  { id: 'Early Roots & Childhood', label: 'Early Roots & Childhood', icon: '🌱' },
  { id: 'Family, Parents & Ancestry', label: 'Family & Ancestry', icon: '👨‍👩‍👧' },
  { id: 'Turning Points & Major Choices', label: 'Turning Points', icon: '⚡' },
  { id: 'Love, Friendship & Lifelong Bonds', label: 'Love & Bonds', icon: '💖' },
  { id: 'Adversity, Hardships & Resilience', label: 'Adversity & Resilience', icon: '🛡️' },
  { id: 'Wisdom, Philosophy & Legacy for Posterity', label: 'Wisdom & Legacy', icon: '📜' },
];

export default function BiographerPage({ onNavigate }) {
  const [selectedEra, setSelectedEra] = useState('all');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);

  // Spoken / Written Response State
  const [rawAnswer, setRawAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);

  // Synthesis & Memoir Draft State
  const [synthesizing, setSynthesizing] = useState(false);
  const [memoirDraft, setMemoirDraft] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftCategory, setDraftCategory] = useState('Personal Reflection');
  const [draftDate, setDraftDate] = useState('');
  const [draftImportance, setDraftImportance] = useState(8.5);
  const [draftTags, setDraftTags] = useState([]);

  // Save State
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedMemoryId, setSavedMemoryId] = useState(null);

  const recognitionRef = useRef(null);

  // Initialize Speech Recognition if supported in browser
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        setRawAnswer((prev) => {
          const base = prev.endsWith(' ') || prev.length === 0 ? prev : prev + ' ';
          return (base + finalTranscript).trim() + (interimTranscript ? ` ${interimTranscript}` : '');
        });
      };

      recognizer.onerror = (e) => {
        console.warn('Speech recognition notice:', e.error);
        setIsRecording(false);
      };

      recognizer.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognizer;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Fetch initial question
  const fetchQuestion = async (era = null, excludeId = null) => {
    try {
      setLoadingQuestion(true);
      const params = {};
      if (era && era !== 'all') params.era = era;
      if (excludeId) params.exclude_id = excludeId;

      const q = await api.biographer.nextQuestion(params);
      setCurrentQuestion(q);
      // Reset answer & draft for fresh question
      setRawAnswer('');
      setMemoirDraft(null);
      setSavedSuccess(false);
    } catch (err) {
      console.error('Failed to fetch biographer question:', err);
    } finally {
      setLoadingQuestion(false);
    }
  };

  useEffect(() => {
    fetchQuestion(selectedEra);
  }, [selectedEra]);

  // Read question aloud via Web Speech Synthesis
  const handleToggleSpeakQuestion = () => {
    if (!window.speechSynthesis || !currentQuestion) return;

    if (isSpeakingQuestion) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeakingQuestion(false);
    utterance.onerror = () => setIsSpeakingQuestion(false);

    setIsSpeakingQuestion(true);
    window.speechSynthesis.speak(utterance);
  };

  // Toggle voice dictation
  const handleToggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech-to-text is not supported by your browser. Please type your thoughts in the text box below.');
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start microphone:', err);
      }
    }
  };

  // Synthesize answer into memoir chapter
  const handleSynthesize = async () => {
    if (!rawAnswer.trim() || !currentQuestion) return;

    try {
      setSynthesizing(true);
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
      }

      const res = await api.biographer.synthesize({
        question: currentQuestion.question,
        user_response_text: rawAnswer,
        era: currentQuestion.era,
        category: currentQuestion.category,
      });

      setMemoirDraft(res);
      setDraftTitle(res.title);
      setDraftContent(res.polished_content);
      setDraftCategory(res.category || currentQuestion.category || 'Personal Reflection');
      setDraftDate(res.event_date || '');
      setDraftImportance(res.importance || 8.5);
      setDraftTags(res.tags || ['memoir', 'oral-history']);
    } catch (err) {
      alert(err.message || 'Failed to synthesize memoir draft.');
    } finally {
      setSynthesizing(false);
    }
  };

  // Save approved memoir to DB & pgvector
  const handleSaveToVault = async () => {
    if (!draftTitle.trim() || !draftContent.trim()) return;

    try {
      setSaving(true);
      const res = await api.biographer.save({
        title: draftTitle.trim(),
        content: draftContent.trim(),
        category: draftCategory,
        event_date: draftDate ? draftDate : null,
        importance: parseFloat(draftImportance) || 8.0,
        tags: draftTags,
      });

      setSavedSuccess(true);
      setSavedMemoryId(res.id);
    } catch (err) {
      alert(err.message || 'Failed to save memoir to vault.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '980px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
          <Sparkles size={14} /> AI Biographer & Oral Historian
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.8px', marginBottom: '8px' }}>
          Autobiographical Interview Mode
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '680px', lineHeight: '1.6' }}>
          Let your AI Biographer interview you through life eras. Speak naturally—Gemini weaves your spoken memories into an evocative, permanent memoir chapter in your cognitive vault.
        </p>
      </div>

      {/* Life Eras Pills Bar */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '14px', marginBottom: '24px', scrollbarWidth: 'none' }}>
        {ERA_LIST.map((era) => {
          const isSelected = selectedEra === era.id;
          return (
            <button
              key={era.id}
              onClick={() => setSelectedEra(era.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.9)' : 'rgba(15, 23, 42, 0.65)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                border: isSelected ? '1px solid #818cf8' : '1px solid var(--border-color)',
                boxShadow: isSelected ? '0 4px 16px rgba(99, 102, 241, 0.35)' : 'none',
                transition: 'all 0.18s ease',
                cursor: 'pointer',
              }}
            >
              <span>{era.icon}</span>
              <span>{era.label}</span>
            </button>
          );
        })}
      </div>

      {/* Interviewer Stage Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(129, 140, 248, 0.35)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 24px rgba(99, 102, 241, 0.15)',
          padding: '28px',
          borderRadius: '20px',
          marginBottom: '28px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Biographer Avatar */}
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #c084fc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: '700',
                fontSize: '16px',
                boxShadow: '0 0 16px rgba(129, 140, 248, 0.5)',
              }}
            >
              EB
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Eleanor - Master Biographer</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {currentQuestion?.era || 'Oral History Journalist'}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleToggleSpeakQuestion}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Listen to question spoken aloud"
            >
              {isSpeakingQuestion ? <VolumeX size={15} color="#ef4444" /> : <Volume2 size={15} />}
              <span>{isSpeakingQuestion ? 'Stop Audio' : 'Listen'}</span>
            </button>
            <button
              onClick={() => fetchQuestion(selectedEra, currentQuestion?.id)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Get another question"
            >
              <Shuffle size={14} /> Next Question
            </button>
          </div>
        </div>

        {/* Current Question Body */}
        {loadingQuestion ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
            Curating thoughtful biographical prompt...
          </div>
        ) : (
          <div>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#f8fafc',
                lineHeight: '1.5',
                letterSpacing: '-0.3px',
                marginBottom: '10px',
              }}
            >
              "{currentQuestion?.question}"
            </h2>
            {currentQuestion?.hint && (
              <p style={{ fontSize: '14px', color: '#94a3b8', fontStyle: 'italic', marginBottom: '0' }}>
                💡 {currentQuestion.hint}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Answer & Voice Dictation Console */}
      <div
        className="card"
        style={{
          padding: '24px',
          borderRadius: '20px',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid var(--border-color)',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <label style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Your Spoken or Written Memories:
          </label>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {rawAnswer.split(/\s+/).filter(Boolean).length} words spoken
          </span>
        </div>

        {/* Text Area */}
        <textarea
          rows={5}
          value={rawAnswer}
          onChange={(e) => setRawAnswer(e.target.value)}
          placeholder="Speak your truth or type here... Talk about what happened, how it felt, who was there, and why it mattered to you."
          style={{
            width: '100%',
            backgroundColor: 'rgba(2, 6, 23, 0.6)',
            border: isRecording ? '1px solid #ef4444' : '1px solid var(--border-color)',
            boxShadow: isRecording ? '0 0 12px rgba(239, 68, 68, 0.3)' : 'none',
            borderRadius: '12px',
            padding: '14px',
            color: '#fff',
            fontSize: '14px',
            lineHeight: '1.6',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.2s ease',
            marginBottom: '16px',
          }}
        />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mic Toggle Button */}
            <button
              onClick={handleToggleRecording}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: isRecording ? '#ef4444' : 'rgba(99, 102, 241, 0.2)',
                color: isRecording ? '#fff' : '#a5b4fc',
                border: isRecording ? '1px solid #dc2626' : '1px solid rgba(99, 102, 241, 0.4)',
                boxShadow: isRecording ? '0 0 18px rgba(239, 68, 68, 0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{isRecording ? 'Stop Recording' : 'Speak via Mic'}</span>
            </button>

            {isRecording && (
              <span style={{ fontSize: '13px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulse-orb" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                Listening to your story...
              </span>
            )}
          </div>

          {/* Synthesize Button */}
          <button
            onClick={handleSynthesize}
            disabled={synthesizing || !rawAnswer.trim()}
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
              opacity: !rawAnswer.trim() ? 0.5 : 1,
            }}
          >
            {synthesizing ? (
              <>
                <RefreshCw size={16} className="spin" /> Synthesizing Memoir...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Weave Into Memoir
              </>
            )}
          </button>
        </div>
      </div>

      {/* Polished Memoir Studio (Preview & Edit) */}
      {memoirDraft && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5), 0 0 30px rgba(168, 85, 247, 0.15)',
            padding: '30px',
            borderRadius: '24px',
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <CheckCircle size={13} style={{ marginRight: '4px' }} /> AI Polished Draft
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Review, polish, and approve for permanent archival
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', fontSize: '13px', fontWeight: '700' }}>
              <Star size={15} fill="var(--warning)" /> Significance: {draftImportance}/10
            </div>
          </div>

          {/* Title Editor */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Memoir Chapter Title
            </label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '18px',
                fontWeight: '700',
                color: '#fff',
                backgroundColor: 'rgba(2, 6, 23, 0.7)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Metadata Row: Category & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Category
              </label>
              <input
                type="text"
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '13px',
                  backgroundColor: 'rgba(2, 6, 23, 0.7)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: '#fff',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Event Date (Approximate or Exact)
              </label>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '13px',
                  backgroundColor: 'rgba(2, 6, 23, 0.7)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: '#fff',
                }}
              />
            </div>
          </div>

          {/* Polished Content */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Polished Memoir Prose
            </label>
            <textarea
              rows={8}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '15px',
                lineHeight: '1.7',
                color: '#f8fafc',
                backgroundColor: 'rgba(2, 6, 23, 0.7)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <Tag size={14} color="var(--text-muted)" />
            {draftTags.map((tag, idx) => (
              <span key={idx} className="badge badge-info" style={{ fontSize: '11px' }}>
                #{tag}
              </span>
            ))}
          </div>

          {/* Follow-up Question Suggestion */}
          {memoirDraft.follow_up_question && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#818cf8', fontWeight: '700', letterSpacing: '0.6px' }}>
                  Biographer's Next Inquiry
                </div>
                <div style={{ fontSize: '14px', color: '#e2e8f0', marginTop: '2px', fontWeight: '500' }}>
                  "{memoirDraft.follow_up_question}"
                </div>
              </div>
            </div>
          )}

          {/* Save Status / Buttons */}
          {savedSuccess ? (
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                textAlign: 'center',
              }}
            >
              <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>
                Memory Archived to Vault & 768-D Vector Indexed!
              </h3>
              <p style={{ fontSize: '14px', color: '#a7f3d0', marginBottom: '16px' }}>
                This chapter is now permanently preserved and accessible by your RAG Chat & Voice Assistant.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onNavigate('memory-detail', { memoryId: savedMemoryId })}
                >
                  <BookOpen size={15} /> View in Library
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => fetchQuestion(selectedEra, currentQuestion?.id)}
                >
                  Record Next Chapter <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setMemoirDraft(null)}
                disabled={saving}
              >
                Discard Draft
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveToVault}
                disabled={saving}
                style={{
                  padding: '12px 28px',
                  fontSize: '14px',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                }}
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Archiving to Vector Vault...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} /> Approve & Store in Vault
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

