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
  BookMarked,
  Settings2,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import CitationCard from '../components/CitationCard';

export default function VoicePage({ onNavigate }) {
  const [mode, setMode] = useState('live'); // 'live' | 'fallback'
  const [voiceState, setVoiceState] = useState('idle'); // idle, connecting, listening, processing, speaking, error, fallback
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [fallbackReason, setFallbackReason] = useState('');

  // Refs for Live Mode (16kHz PCM streaming)
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const inputAudioCtxRef = useRef(null);
  const processorNodeRef = useRef(null);
  const outputAudioCtxRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const isMutedRef = useRef(isMuted);

  // Refs for Fallback Mode (MediaRecorder)
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Clean up all audio nodes and websocket on unmount
  useEffect(() => {
    return () => {
      cleanupAllAudio();
    };
  }, []);

  const cleanupAllAudio = () => {
    // Stop browser TTS if speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Clean MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    // Clean Live Web Audio nodes
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

  // Convert Float32Array from microphone to 16-bit Linear PCM (Live mode)
  const floatTo16BitPCM = (input) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output.buffer;
  };

  // Play incoming 24kHz 16-bit PCM audio chunks from Gemini Live
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

      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);

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

  // Browser SpeechSynthesis Native Playback (Fallback TTS)
  const speakWithBrowserTTS = (textToSpeak) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('idle');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    setVoiceState('speaking');
    utterance.onend = () => {
      setVoiceState('idle');
    };
    utterance.onerror = () => {
      setVoiceState('idle');
    };

    window.speechSynthesis.speak(utterance);
  };

  // -------------------------------------------------------------
  // Mode 1: Gemini Live Multimodal Streaming (Stage 9)
  // -------------------------------------------------------------
  const startLiveVoiceSession = async () => {
    setErrorMessage('');
    setFallbackReason('');
    setTranscript('');
    setAnswer('');
    setCitations([]);
    setVoiceState('connecting');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser.');
      }

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

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const wsUrl = `${protocol}//${host}:8000/ws/voice-live`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setVoiceState('listening');
        setTranscript('Connected to Gemini Live. Speak naturally about your memories.');

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
            setMode('fallback');
            setVoiceState('idle');
            setFallbackReason(data.reason || data.message || 'Gemini Live model is currently offline. Switched to Fallback Mode.');
          } else if (data.type === 'error') {
            setErrorMessage(data.error);
            setVoiceState('error');
          }
        } catch (e) {
          console.error('Failed to parse voice server message:', e);
        }
      };

      ws.onclose = () => {
        if (voiceState !== 'error' && mode === 'live') {
          setVoiceState('idle');
        }
      };

      ws.onerror = (err) => {
        console.warn('Voice WebSocket error:', err);
        setMode('fallback');
        setVoiceState('idle');
        setFallbackReason('Live WebSocket stream disconnected. Switched to Fallback Voice Mode (STT + TTS).');
      };
    } catch (err) {
      cleanupAllAudio();
      setVoiceState('error');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
          : err.message || 'Failed to start Gemini Live voice session.'
      );
    }
  };

  // -------------------------------------------------------------
  // Mode 2: Stage 10 Fallback Voice Pipeline (STT + RAG + TTS)
  // -------------------------------------------------------------
  const startFallbackVoiceRecording = async () => {
    setErrorMessage('');
    setTranscript('');
    setAnswer('');
    setCitations([]);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());

        // Send to Fallback Query Pipeline
        await processFallbackAudioQuery(audioBlob);
      };

      mediaRecorder.start();
      setVoiceState('listening');
      setTranscript('Recording your voice question... Tap microphone again when finished.');
    } catch (err) {
      setVoiceState('error');
      setErrorMessage(err.message || 'Failed to record audio.');
    }
  };

  const stopFallbackVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setVoiceState('processing');
      mediaRecorderRef.current.stop();
    }
  };

  const processFallbackAudioQuery = async (audioBlob) => {
    setVoiceState('processing');
    setTranscript('Transcribing speech and querying stored memories...');

    try {
      const response = await api.voice.query({
        audio: audioBlob,
        voice_name: 'Aoede',
      });

      setTranscript(response.transcript || 'Spoken question recognized.');
      setAnswer(response.answer);
      setCitations(response.sources || []);

      // If server returned audio, play via Web Audio, else use browser TTS
      if (response.audio_base64) {
        playIncomingPCMChunk(response.audio_base64, 24000);
      } else {
        speakWithBrowserTTS(response.answer);
      }
    } catch (err) {
      setVoiceState('error');
      setErrorMessage(err.message || 'Failed to process voice query.');
    }
  };

  // Main Action Toggle Handler
  const handleMicrophoneClick = () => {
    if (mode === 'live') {
      if (voiceState === 'idle' || voiceState === 'error') {
        startLiveVoiceSession();
      } else {
        cleanupAllAudio();
        setVoiceState('idle');
      }
    } else {
      // Fallback Mode
      if (voiceState === 'idle' || voiceState === 'error') {
        startFallbackVoiceRecording();
      } else if (voiceState === 'listening') {
        stopFallbackVoiceRecording();
      } else if (voiceState === 'speaking') {
        cleanupAllAudio();
        setVoiceState('idle');
      }
    }
  };

  const getStateBadge = () => {
    switch (voiceState) {
      case 'connecting':
        return <span className="badge badge-warning"><Radio size={12} /> Connecting...</span>;
      case 'listening':
        return (
          <span className="badge badge-success">
            <Radio size={12} /> {mode === 'live' ? 'Listening (Live 16kHz Stream)' : 'Recording Voice (Tap to Stop)'}
          </span>
        );
      case 'processing':
        return <span className="badge badge-info"><Sparkles size={12} /> Transcribing & Searching Memories...</span>;
      case 'speaking':
        return <span className="badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}><Volume2 size={12} /> AI Speaking</span>;
      case 'error':
        return <span className="badge badge-danger">Microphone / Connection Error</span>;
      default:
        return <span className="badge badge-info">{mode === 'live' ? 'Gemini Live Ready' : 'Fallback Voice Ready'}</span>;
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '800px', textAlign: 'center' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800' }}>Voice Memory Assistant</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
          Spoken conversation grounded in your stored memories via Gemini Live API & Fallback Pipeline.
        </p>

        {/* Mode Selector Tabs */}
        <div style={{ display: 'inline-flex', padding: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginTop: '16px', border: '1px solid var(--border-color)' }}>
          <button
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'live' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'live' ? '#ffffff' : 'var(--text-secondary)',
            }}
            onClick={() => {
              cleanupAllAudio();
              setMode('live');
              setVoiceState('idle');
            }}
          >
            ⚡ Gemini Live Mode (Real-Time)
          </button>
          <button
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'fallback' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'fallback' ? '#ffffff' : 'var(--text-secondary)',
            }}
            onClick={() => {
              cleanupAllAudio();
              setMode('fallback');
              setVoiceState('idle');
            }}
          >
            🛡️ Fallback Mode (STT + RAG + TTS)
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

      {/* Fallback Notice Banner */}
      {fallbackReason && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', textAlign: 'left', borderColor: 'var(--accent-warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-warning)', fontSize: '13px' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{fallbackReason}</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setFallbackReason('')}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Voice Center Card */}
      <div className="card" style={{ padding: '50px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          {getStateBadge()}
        </div>

        {/* Visualizer Pulsing Circle */}
        <div
          onClick={handleMicrophoneClick}
          style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            backgroundColor:
              voiceState === 'listening'
                ? 'var(--accent-success)'
                : voiceState === 'speaking'
                ? '#a855f7'
                : voiceState === 'processing'
                ? 'var(--accent-primary)'
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
          {voiceState === 'idle' || voiceState === 'error'
            ? mode === 'live'
              ? 'Tap microphone to start real-time conversation'
              : 'Tap microphone to record voice question'
            : voiceState === 'speaking'
            ? 'AI Replica is speaking...'
            : voiceState === 'processing'
            ? 'Synthesizing grounded memory response...'
            : mode === 'live'
            ? 'Listening... speak naturally'
            : 'Listening... tap microphone when finished'}
        </h3>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '520px', lineHeight: '1.6', minHeight: '36px' }}>
          {transcript || (mode === 'live'
            ? 'Speak naturally into your microphone. The AI will retrieve your memories and respond with grounded speech in real-time.'
            : 'Record a question about your memories. The system will transcribe, perform RAG retrieval, and speak the verified answer.')}
        </p>

        {/* Spoken Answer Text */}
        {answer && (
          <div style={{
            marginTop: '20px',
            padding: '16px 20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            textAlign: 'left',
            maxWidth: '600px',
            width: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--accent-primary)', marginBottom: '6px' }}>
              <Volume2 size={14} /> Grounded Spoken Response
            </div>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {answer}
            </p>
          </div>
        )}

        {/* Citations Panel */}
        {citations.length > 0 && (
          <div style={{ width: '100%', maxWidth: '600px', marginTop: '16px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <BookMarked size={14} /> Grounded Sources ({citations.length})
            </div>
            {citations.map((cit, idx) => (
              <CitationCard
                key={idx}
                citation={cit}
                onOpenMemory={(memId) => onNavigate && onNavigate('memory-detail', { memoryId: memId })}
              />
            ))}
          </div>
        )}

        {/* Action Controls */}
        {voiceState !== 'idle' && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            {mode === 'live' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsMuted(!isMuted)}
                disabled={voiceState === 'error'}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {isMuted ? 'Unmute Mic' : 'Mute Mic'}
              </button>
            )}
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                cleanupAllAudio();
                setVoiceState('idle');
              }}
            >
              Stop Voice Session
            </button>
          </div>
        )}
      </div>

      {/* Voice Privacy & Protocol Card */}
      <div className="card" style={{ textAlign: 'left', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Shield size={18} color="var(--accent-success)" />
          <h4 style={{ fontSize: '14px', fontWeight: '600' }}>Dual-Engine Voice Preservation Architecture</h4>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Human Legacy AI employs a multi-tiered voice layer: primary bidirectional audio streaming powered by Google Gemini Live Multimodal API
          with instant automatic fallback to Speech-to-Text (STT) + pgvector RAG + Text-to-Speech (TTS) synthesis.
          Microphone access is strictly session-bound and all operations are securely authenticated.
        </p>
      </div>
    </div>
  );
}
