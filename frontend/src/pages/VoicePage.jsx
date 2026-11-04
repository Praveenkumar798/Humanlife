import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Shield,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function VoicePage() {
  const [voiceState, setVoiceState] = useState('idle'); // idle, requesting_permission, listening, processing, speaking, stopped, error
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [transcript, setTranscript] = useState('');

  const handleStartVoice = async () => {
    setErrorMessage('');
    setVoiceState('requesting_permission');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Successfully got permission
      setVoiceState('listening');
      setTranscript('Listening... Speak your question about your memories.');

      // Stop stream tracks for now (full streaming wired in Stage 9)
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setVoiceState('error');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
          : err.message || 'Failed to initialize audio capture.'
      );
    }
  };

  const handleStopVoice = () => {
    setVoiceState('idle');
    setTranscript('');
  };

  const getStateBadge = () => {
    switch (voiceState) {
      case 'listening':
        return <span className="badge badge-success"><Radio size={12} /> Listening</span>;
      case 'processing':
        return <span className="badge badge-info"><Sparkles size={12} /> Processing with Gemini</span>;
      case 'speaking':
        return <span className="badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}><Volume2 size={12} /> AI Speaking</span>;
      case 'requesting_permission':
        return <span className="badge badge-warning">Requesting Mic Access</span>;
      case 'error':
        return <span className="badge badge-danger">Microphone Error</span>;
      default:
        return <span className="badge badge-info">Ready to Start</span>;
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '800px', textAlign: 'center' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800' }}>Voice Memory Assistant</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
          Real-time spoken conversation grounded in your stored memories via Gemini Live API.
        </p>
      </div>

      {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

      {/* Main Voice Center Card */}
      <div className="card" style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          {getStateBadge()}
        </div>

        {/* Pulsing Visualizer Circle */}
        <div
          onClick={voiceState === 'idle' || voiceState === 'error' ? handleStartVoice : handleStopVoice}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: voiceState === 'listening' ? 'var(--success)' : 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: voiceState === 'listening'
              ? '0 0 0 16px rgba(16, 185, 129, 0.2), 0 0 0 32px rgba(16, 185, 129, 0.1)'
              : '0 0 0 10px rgba(59, 130, 246, 0.15)',
            transition: 'all 0.3s ease',
            marginBottom: '28px',
          }}
        >
          {voiceState === 'listening' ? <Mic size={48} /> : <MicOff size={48} />}
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
          {voiceState === 'idle' || voiceState === 'error' ? 'Tap microphone to start conversation' : 'Tap to end session'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '440px', lineHeight: '1.5' }}>
          {transcript || 'When active, speak naturally. The AI will retrieve your memories and respond with grounded speech.'}
        </p>

        {/* Voice Control Buttons */}
        {voiceState !== 'idle' && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isMuted ? 'Unmute Audio' : 'Mute Audio'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleStopVoice}
            >
              End Voice Session
            </button>
          </div>
        )}
      </div>

      {/* Voice Privacy & Protocol Card */}
      <div className="card" style={{ textAlign: 'left', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <Shield size={18} color="var(--success)" />
          <h4 style={{ fontSize: '14px', fontWeight: '600' }}>Voice Privacy & Consent Protocol</h4>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Microphone access is requested strictly when initiated by you and immediately terminates when you stop.
          No background recording takes place. All voice audio is transmitted securely through our backend WebSocket
          to Google Gemini Live API.
        </p>
      </div>
    </div>
  );
}

