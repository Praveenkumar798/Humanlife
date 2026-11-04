import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Shield,
  Sparkles,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export default function VoicePage() {
  const [voiceState, setVoiceState] = useState('idle'); // idle, connecting, listening, speaking, error, fallback
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [fallbackReason, setFallbackReason] = useState('');

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const inputAudioCtxRef = useRef(null);
  const processorNodeRef = useRef(null);
  const outputAudioCtxRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Clean up all audio nodes and websocket on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  };

  // Convert Float32Array from microphone to 16-bit Linear PCM
  const floatTo16BitPCM = (input) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output.buffer;
  };

  // Play incoming 24kHz 16-bit PCM audio chunks from Gemini
  const playIncomingPCMChunk = (base64Data, sampleRate = 24000) => {
    try {
      if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        outputAudioCtxRef.current = new AudioContextClass({ sampleRate });
      }

      const audioCtx = outputAudioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Decode base64 to bytes
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit signed PCM to float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create AudioBuffer
      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);

      // Schedule seamless audio playback
      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      sourceNode.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      setVoiceState('speaking');

      sourceNode.onended = () => {
        if (audioCtx.currentTime >= nextPlayTimeRef.current - 0.05) {
          setVoiceState('listening');
        }
      };
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  };

  const handleStartVoice = async () => {
    setErrorMessage('');
    setFallbackReason('');
    setTranscript('');
    setVoiceState('connecting');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser.');
      }

      // 1. Initialize Microphone Audio Stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Connect WebSocket to /ws/voice-live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const wsUrl = `${protocol}//${host}:8000/ws/voice-live`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setVoiceState('listening');
        setTranscript('Connected to Gemini Live. Speak naturally about your memories.');

        // Initialize AudioContext & ScriptProcessor for 16kHz PCM streaming
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass({ sampleRate: 16000 });
        inputAudioCtxRef.current = audioCtx;

        const micSource = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorNodeRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBuffer = floatTo16BitPCM(inputData);
          wsRef.current.send(pcmBuffer);
        };

        micSource.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'live_ready') {
            setVoiceState('listening');
          } else if (data.type === 'audio' && data.data) {
            playIncomingPCMChunk(data.data, 24000);
          } else if (data.type === 'transcript') {
            setTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
          } else if (data.type === 'turn_complete') {
            setVoiceState('listening');
          } else if (data.type === 'fallback_needed') {
            setVoiceState('fallback');
            setFallbackReason(data.reason || data.message || 'Gemini Live model is currently unavailable.');
          } else if (data.type === 'error') {
            setErrorMessage(data.error);
            setVoiceState('error');
          }
        } catch (e) {
          console.error('Failed to parse voice server message:', e);
        }
      };

      ws.onclose = () => {
        if (voiceState !== 'fallback' && voiceState !== 'error') {
          setVoiceState('idle');
        }
      };

      ws.onerror = (err) => {
        console.warn('Voice WebSocket error:', err);
        setVoiceState('error');
        setErrorMessage('Failed to connect to voice streaming server.');
      };
    } catch (err) {
      cleanupAudio();
      setVoiceState('error');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
          : err.message || 'Failed to start Gemini Live voice session.'
      );
    }
  };

  const handleStopVoice = () => {
    cleanupAudio();
    setVoiceState('idle');
    setTranscript('');
  };

  const getStateBadge = () => {
    switch (voiceState) {
      case 'connecting':
        return <span className="badge badge-warning"><Radio size={12} /> Connecting Gemini Live...</span>;
      case 'listening':
        return <span className="badge badge-success"><Radio size={12} /> Listening (16kHz Live)</span>;
      case 'speaking':
        return <span className="badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}><Volume2 size={12} /> Gemini Live Speaking</span>;
      case 'fallback':
        return <span className="badge badge-warning"><AlertTriangle size={12} /> Live API Offline — Fallback Ready</span>;
      case 'error':
        return <span className="badge badge-danger">Microphone / Connection Error</span>;
      default:
        return <span className="badge badge-info">Gemini Live Ready</span>;
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

      {/* Fallback Notice */}
      {voiceState === 'fallback' && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px', textAlign: 'left', borderColor: 'var(--accent-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-warning)', marginBottom: '8px' }}>
            <AlertTriangle size={20} />
            <h4 style={{ fontSize: '15px', fontWeight: '700' }}>Gemini Live API Notice</h4>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {fallbackReason}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Stage 10 (Speech-to-Text + RAG + Text-to-Speech Fallback) will provide an automatic offline backup.
          </p>
        </div>
      )}

      {/* Main Voice Center Card */}
      <div className="card" style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          {getStateBadge()}
        </div>

        {/* Visualizer Pulsing Circle */}
        <div
          onClick={voiceState === 'idle' || voiceState === 'error' || voiceState === 'fallback' ? handleStartVoice : handleStopVoice}
          style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            backgroundColor:
              voiceState === 'listening'
                ? 'var(--accent-success)'
                : voiceState === 'speaking'
                ? '#a855f7'
                : 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            boxShadow:
              voiceState === 'listening'
                ? '0 0 0 16px rgba(16, 185, 129, 0.2), 0 0 0 32px rgba(16, 185, 129, 0.1)'
                : voiceState === 'speaking'
                ? '0 0 0 16px rgba(168, 85, 247, 0.25), 0 0 0 32px rgba(168, 85, 247, 0.12)'
                : '0 0 0 10px rgba(59, 130, 246, 0.15)',
            transition: 'all 0.3s ease',
            marginBottom: '28px',
          }}
        >
          {voiceState === 'listening' || voiceState === 'speaking' ? <Mic size={52} /> : <MicOff size={52} />}
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
          {voiceState === 'idle' || voiceState === 'error' || voiceState === 'fallback'
            ? 'Tap microphone to start conversation'
            : voiceState === 'speaking'
            ? 'Gemini Live is speaking...'
            : 'Listening... speak naturally'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '480px', lineHeight: '1.6', minHeight: '40px' }}>
          {transcript || 'When active, speak naturally into your microphone. The AI will retrieve your memories and respond with grounded speech in real-time.'}
        </p>

        {/* Voice Control Action Buttons */}
        {voiceState !== 'idle' && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsMuted(!isMuted)}
              disabled={voiceState === 'error' || voiceState === 'fallback'}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isMuted ? 'Unmute Mic' : 'Mute Mic'}
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
          <Shield size={18} color="var(--accent-success)" />
          <h4 style={{ fontSize: '14px', fontWeight: '600' }}>Voice Privacy & Consent Protocol</h4>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Microphone access is requested strictly when initiated by you and immediately terminates when you stop.
          No background recording takes place. Audio is streamed as 16kHz PCM through your backend WebSocket
          to Google Gemini Live API and grounded in your personal archive.
        </p>
      </div>
    </div>
  );
}
