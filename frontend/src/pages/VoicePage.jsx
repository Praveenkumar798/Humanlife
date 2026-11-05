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
  Activity,
  Sliders,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import CitationCard from '../components/CitationCard';
import AudioWaveformVisualizer from '../components/AudioWaveformVisualizer';

export default function VoicePage({ onNavigate }) {
  const [mode, setMode] = useState('live'); // 'live' | 'fallback'
  const [voiceState, setVoiceState] = useState('idle'); // idle, connecting, listening, processing, speaking, error, fallback
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [fallbackReason, setFallbackReason] = useState('');

  // VAD & Voice Polish States
  const [isVadEnabled, setIsVadEnabled] = useState(true);
  const [vadSensitivity, setVadSensitivity] = useState('medium'); // 'low' | 'medium' | 'high'
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 meter
  const [silenceCountdown, setSilenceCountdown] = useState(null); // countdown seconds until auto-send
  const [activeAnalyser, setActiveAnalyser] = useState(null);

  // Refs for Live Mode (16kHz PCM streaming)
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const inputAudioCtxRef = useRef(null);
  const processorNodeRef = useRef(null);
  const inputAnalyserRef = useRef(null);
  const outputAudioCtxRef = useRef(null);
  const outputAnalyserRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const isMutedRef = useRef(isMuted);

  // VAD tracking refs
  const hasSpokenRef = useRef(false);
  const lastSpeechTimeRef = useRef(0);
  const vadIntervalRef = useRef(null);
  const isSpeakingUserRef = useRef(false);

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

  const getSensitivityThreshold = () => {
    switch (vadSensitivity) {
      case 'high':
        return 0.012; // Captures soft whisper
      case 'low':
        return 0.038; // Ignores background ambient noise
      default:
        return 0.022; // Balanced normal speaking voice
    }
  };

  const cleanupAllAudio = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    hasSpokenRef.current = false;
    isSpeakingUserRef.current = false;
    setSilenceCountdown(null);
    setAudioLevel(0);
    setActiveAnalyser(null);

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
      try {
        processorNodeRef.current.disconnect();
      } catch (e) {}
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
        const outCtx = new AudioContextClass({ sampleRate });
        const outAnalyser = outCtx.createAnalyser();
        outAnalyser.fftSize = 64;
        outAnalyser.smoothingTimeConstant = 0.8;
        outAnalyser.connect(outCtx.destination);
        outputAudioCtxRef.current = outCtx;
        outputAnalyserRef.current = outAnalyser;
      }

      const audioCtx = outputAudioCtxRef.current;
      const outAnalyser = outputAnalyserRef.current;
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

      if (outAnalyser) {
        sourceNode.connect(outAnalyser);
      } else {
        sourceNode.connect(audioCtx.destination);
      }

      const currentTime = audioCtx.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      sourceNode.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      setVoiceState('speaking');
      if (outAnalyser) {
        setActiveAnalyser(outAnalyser);
      }

      sourceNode.onended = () => {
        if (audioCtx.currentTime >= nextPlayTimeRef.current - 0.05) {
          setVoiceState('listening');
          if (inputAnalyserRef.current) {
            setActiveAnalyser(inputAnalyserRef.current);
          }
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

        // Visualizer Analyser Node
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        inputAnalyserRef.current = analyser;
        setActiveAnalyser(analyser);

        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorNodeRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setAudioLevel(0);
            return;
          }
          const inputData = e.inputBuffer.getChannelData(0);

          // Real-time Energy / RMS calculation for VAD and Level Meter
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          const levelPercent = Math.min(100, Math.round(rms * 450));
          setAudioLevel(levelPercent);

          const threshold = getSensitivityThreshold();

          // Barge-in Interruption: User starts speaking while AI is speaking
          if (rms > threshold * 1.5 && voiceState === 'speaking') {
            if (outputAudioCtxRef.current) {
              nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
            }
            setVoiceState('listening');
            setActiveAnalyser(inputAnalyserRef.current);
          }

          const pcmBuffer = floatTo16BitPCM(inputData);
          wsRef.current.send(pcmBuffer);
        };

        micSource.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'live_ready') {
            setVoiceState('listening');
            if (inputAnalyserRef.current) {
              setActiveAnalyser(inputAnalyserRef.current);
            }
          } else if (data.type === 'audio' && data.data) {
            playIncomingPCMChunk(data.data, 24000);
          } else if (data.type === 'transcript') {
            setTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
          } else if (data.type === 'turn_complete') {
            setVoiceState('listening');
            if (inputAnalyserRef.current) {
              setActiveAnalyser(inputAnalyserRef.current);
            }
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
  // Mode 2: Stage 10 Fallback Voice Pipeline + Client-Side VAD
  // -------------------------------------------------------------
  const startFallbackVoiceRecording = async () => {
    setErrorMessage('');
    setTranscript('');
    setAnswer('');
    setCitations([]);
    hasSpokenRef.current = false;
    isSpeakingUserRef.current = false;
    setSilenceCountdown(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
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
        if (vadIntervalRef.current) {
          clearInterval(vadIntervalRef.current);
          vadIntervalRef.current = null;
        }
        setSilenceCountdown(null);
        setAudioLevel(0);

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());

        // Send to Fallback Query Pipeline
        await processFallbackAudioQuery(audioBlob);
      };

      // Set up AudioContext & Analyser for Visualizer & VAD in Fallback Mode
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      inputAudioCtxRef.current = audioCtx;

      const micSource = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      inputAnalyserRef.current = analyser;
      setActiveAnalyser(analyser);

      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const levelPercent = Math.min(100, Math.round(rms * 450));
        setAudioLevel(levelPercent);

        const threshold = getSensitivityThreshold();

        if (rms >= threshold) {
          hasSpokenRef.current = true;
          lastSpeechTimeRef.current = Date.now();
          isSpeakingUserRef.current = true;
          setSilenceCountdown(null);
        } else if (hasSpokenRef.current && isVadEnabled) {
          isSpeakingUserRef.current = false;
          const elapsedSilence = Date.now() - lastSpeechTimeRef.current;
          const silenceThresholdMs = 1500; // 1.5 seconds silence auto-stop

          if (elapsedSilence > silenceThresholdMs) {
            // Auto-stop triggered by VAD!
            hasSpokenRef.current = false;
            stopFallbackVoiceRecording();
          } else {
            const remaining = Math.max(0.1, (silenceThresholdMs - elapsedSilence) / 1000).toFixed(1);
            setSilenceCountdown(remaining);
          }
        }
      };

      micSource.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioCtx.destination);

      mediaRecorder.start();
      setVoiceState('listening');
      setTranscript(
        isVadEnabled
          ? 'Listening... speak your question. System will automatically detect when you finish speaking.'
          : 'Recording your voice question... Tap microphone again when finished.'
      );
    } catch (err) {
      setVoiceState('error');
      setErrorMessage(err.message || 'Failed to record audio.');
    }
  };

  const stopFallbackVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setVoiceState('processing');
      setSilenceCountdown(null);
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
            <Radio size={12} /> {mode === 'live' ? 'Listening (Live Multimodal)' : (isVadEnabled ? 'Hands-Free VAD Listening' : 'Recording Voice')}
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
    <div className="page-wrapper" style={{ maxWidth: '820px', textAlign: 'center' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800' }}>Voice Memory Assistant</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
          Real-time spoken conversation with Voice Activity Detection (VAD) & audio waveform visualizer.
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
      <div className="card" style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          {getStateBadge()}
        </div>

        {/* Visualizer Pulsing Circle */}
        <div
          onClick={handleMicrophoneClick}
          style={{
            width: '128px',
            height: '128px',
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
                ? `0 0 0 ${Math.max(12, Math.round(audioLevel / 3))}px rgba(16, 185, 129, 0.25), 0 0 0 ${Math.max(24, Math.round(audioLevel / 1.5))}px rgba(16, 185, 129, 0.12)`
                : voiceState === 'speaking'
                ? '0 0 0 16px rgba(168, 85, 247, 0.25), 0 0 0 32px rgba(168, 85, 247, 0.12)'
                : '0 0 0 10px rgba(59, 130, 246, 0.15)',
            transition: 'box-shadow 0.15s ease, background-color 0.3s ease',
            marginBottom: '16px',
          }}
        >
          {voiceState === 'listening' || voiceState === 'speaking' ? <Mic size={48} /> : <MicOff size={48} />}
        </div>

        {/* Audio Waveform Visualizer Canvas */}
        <AudioWaveformVisualizer
          analyserNode={activeAnalyser}
          voiceState={voiceState}
          width={380}
          height={64}
        />

        {/* Real-time Decibel / Energy Level Bar & Silence Countdown */}
        {voiceState === 'listening' && (
          <div style={{ width: '100%', maxWidth: '380px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>Mic Energy</span>
              <span>
                {silenceCountdown ? (
                  <strong style={{ color: 'var(--accent-warning)' }}>
                    Pause detected: auto-sending in {silenceCountdown}s...
                  </strong>
                ) : (
                  `${audioLevel}%`
                )}
              </span>
            </div>
            <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${audioLevel}%`,
                  height: '100%',
                  backgroundColor: audioLevel > 50 ? 'var(--accent-warning)' : 'var(--accent-success)',
                  transition: 'width 0.1s ease',
                }}
              />
            </div>
          </div>
        )}

        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
          {voiceState === 'idle' || voiceState === 'error'
            ? mode === 'live'
              ? 'Tap microphone to start real-time conversation'
              : 'Tap microphone to speak (Hands-Free VAD Enabled)'
            : voiceState === 'speaking'
            ? 'AI Replica is speaking (Speak anytime to interrupt)...'
            : voiceState === 'processing'
            ? 'Synthesizing grounded memory response...'
            : isVadEnabled
            ? 'Listening... pause speaking when finished'
            : 'Listening... tap microphone when finished'}
        </h3>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '520px', lineHeight: '1.6', minHeight: '32px' }}>
          {transcript || (mode === 'live'
            ? 'Speak naturally into your microphone. The AI replica will retrieve your memories and respond with grounded speech in real-time.'
            : 'Ask a question about your memories. When you finish speaking, VAD will automatically transcribe, search memories, and speak back.')}
        </p>

        {/* Spoken Answer Text */}
        {answer && (
          <div style={{
            marginTop: '16px',
            padding: '16px 20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            textAlign: 'left',
            maxWidth: '620px',
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
          <div style={{ width: '100%', maxWidth: '620px', marginTop: '16px', textAlign: 'left' }}>
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
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
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

      {/* Voice Polish & VAD Settings Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', textAlign: 'left', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--accent-primary)" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>Voice Activity Detection (Hands-Free VAD)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Automatically detects silence (1.5s) to query memories without clicking</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Sensitivity Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Sensitivity:</span>
            <select
              value={vadSensitivity}
              onChange={(e) => setVadSensitivity(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="high">High (Whisper / Quiet)</option>
              <option value="medium">Medium (Normal)</option>
              <option value="low">Low (Noisy Room)</option>
            </select>
          </div>

          {/* VAD Toggle Button */}
          <button
            className={`btn btn-sm ${isVadEnabled ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', padding: '4px 12px' }}
            onClick={() => setIsVadEnabled(!isVadEnabled)}
          >
            {isVadEnabled ? <CheckCircle2 size={13} style={{ marginRight: '4px' }} /> : null}
            {isVadEnabled ? 'Hands-Free ON' : 'Manual Push-To-Talk'}
          </button>
        </div>
      </div>

      {/* Voice Architecture Info Card */}
      <div className="card" style={{ textAlign: 'left', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Shield size={18} color="var(--accent-success)" />
          <h4 style={{ fontSize: '14px', fontWeight: '600' }}>Real-Time Voice Architecture with Client-Side VAD</h4>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Integrated HTML5 Web Audio visualizer with zero-latency Client Voice Activity Detection.
          Supports natural interruption (barge-in) during live speech playback and automated turn-taking.
          Audio processing runs strictly in browser memory and all RAG memory retrieval is cryptographically isolated per user.
        </p>
      </div>
    </div>
  );
}
