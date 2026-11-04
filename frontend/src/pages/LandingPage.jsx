import React from 'react';
import { BrainCircuit, ShieldCheck, Sparkles, Mic, FileText, ArrowRight } from 'lucide-react';

export default function LandingPage({ onGoLogin, onGoRegister }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header style={{
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <BrainCircuit size={20} />
          </div>
          <span style={{ fontSize: '18px', fontWeight: '700' }}>Human Legacy AI</span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onGoLogin}>
            Sign In
          </button>
          <button className="btn btn-primary" onClick={onGoRegister}>
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px', maxWidth: '900px', margin: '0 auto' }}>
        <div className="badge badge-info" style={{ marginBottom: '20px', padding: '6px 14px' }}>
          <Sparkles size={14} /> Private & Evidence-Grounded Cognitive Preservation
        </div>

        <h1 style={{ fontSize: '46px', fontWeight: '800', lineHeight: '1.2', marginBottom: '20px', letterSpacing: '-1px' }}>
          Preserve your memories, values, and decisions for future generations.
        </h1>

        <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '36px', lineHeight: '1.6', maxWidth: '720px' }}>
          Human Legacy AI is a private memory repository that turns your personal stories, journals, and reflections into an interactive AI replica grounded strictly in your verified records.
        </p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '60px' }}>
          <button className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '16px' }} onClick={onGoRegister}>
            Start Your Archive <ArrowRight size={18} />
          </button>
          <button className="btn btn-secondary" style={{ padding: '14px 24px', fontSize: '16px' }} onClick={onGoLogin}>
            Access Existing Vault
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid-3" style={{ width: '100%', textAlign: 'left', marginTop: '20px' }}>
          <div className="card">
            <ShieldCheck size={24} color="var(--accent-primary)" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Grounded RAG & Zero Hallucination</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Answers are generated only from your stored memories. If facts are absent, the system explicitly tells you rather than inventing stories.
            </p>
          </div>

          <div className="card">
            <FileText size={24} color="var(--success)" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>PDF & TXT Extraction</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Upload diaries, letters, and documents. Automatically chunked with page-number citations powered by Gemini embeddings and pgvector.
            </p>
          </div>

          <div className="card">
            <Mic size={24} color="#a855f7" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Real-Time Voice Assistant</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Engage in spoken conversations with your archive via Gemini Live API with speech-to-text and audio fallback.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px' }}>
        Human Legacy AI — Preserving human values, life lessons, and decision patterns. Confidential and private.
      </footer>
    </div>
  );
}

