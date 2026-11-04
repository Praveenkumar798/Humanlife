import React from 'react';
import { User, Cpu, Shield, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="page-wrapper" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800' }}>Settings & Architecture</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Manage your account profile, RAG hyperparameters, and Gemini models.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* User Account Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <User size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Archive Owner Account</h3>
          </div>

          <div className="grid-2" style={{ gap: '16px', fontSize: '14px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Full Name</span>
              <div style={{ fontWeight: '600', marginTop: '2px' }}>{user?.full_name || 'Not provided'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Username</span>
              <div style={{ fontWeight: '600', marginTop: '2px' }}>@{user?.username}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Email Address</span>
              <div style={{ fontWeight: '600', marginTop: '2px' }}>{user?.email}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Member Since</span>
              <div style={{ fontWeight: '600', marginTop: '2px' }}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Model & RAG Configuration */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Cpu size={20} color="var(--success)" />
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>AI & Retrieval-Augmented Generation (RAG)</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>LLM Chat Model</span>
              <span style={{ fontWeight: '600' }}>Gemini 2.0 Flash (`gemini-2.0-flash`)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Dense Vector Embedding Model</span>
              <span style={{ fontWeight: '600' }}>Gemini Embeddings (`text-embedding-004`)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Embedding Vector Dimensions</span>
              <span style={{ fontWeight: '600' }}>768 dimensions (pgvector)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Real-time Live Audio Model</span>
              <span style={{ fontWeight: '600' }}>Gemini 2.0 Live (`gemini-2.0-flash-live-001`)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Default Retrieval Top-K</span>
              <span style={{ fontWeight: '600' }}>5 chunks</span>
            </div>
          </div>
        </div>

        {/* Security & Authentication */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Shield size={20} color="#a855f7" />
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Security & Storage</h3>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
            Authentication tokens are strictly stored inside encrypted <strong>httpOnly</strong> cookies.
            Token values are completely inaccessible to frontend scripts, effectively preventing Cross-Site Scripting (XSS) leaks.
          </div>

          <button className="btn btn-danger btn-sm" onClick={logout}>
            <LogOut size={14} /> Sign Out of All Sessions
          </button>
        </div>
      </div>
    </div>
  );
}

