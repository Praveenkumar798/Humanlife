import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Share2,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Users,
  Eye,
  Shield,
  Volume2,
  Disc,
  Clock,
  Layers,
  Heart,
} from 'lucide-react';
import { api } from '../services/api';

const VOICES = [
  { id: 'Aoede', label: 'Aoede', desc: 'Warm, resonant, evocative (Female)', icon: '🎙️' },
  { id: 'Puck', label: 'Puck', desc: 'Clear, lively, engaging (Male)', icon: '✨' },
  { id: 'Charon', label: 'Charon', desc: 'Deep, reflective, contemplative (Male)', icon: '📜' },
  { id: 'Kore', label: 'Kore', desc: 'Calm, gentle, comforting (Female)', icon: '🕊️' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Rich, authoritative, historical (Male)', icon: '🛡️' },
];

export default function PodcastFamilyPage({ onNavigate }) {
  const [activeSubTab, setActiveSubTab] = useState('podcast'); // 'podcast' | 'family'

  // Podcast State
  const [selectedVoice, setSelectedVoice] = useState('Aoede');
  const [selectedDuration, setSelectedDuration] = useState('standard');
  const [selectedEra, setSelectedEra] = useState('all');
  const [generatingPodcast, setGeneratingPodcast] = useState(false);
  const [podcastEpisode, setPodcastEpisode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef(null);

  // Family Share State
  const [shareData, setShareData] = useState(null);
  const [loadingShare, setLoadingShare] = useState(true);
  const [updatingShare, setUpdatingShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load Family Share info
  const loadShareData = async () => {
    try {
      setLoadingShare(true);
      const data = await api.family.getShare();
      setShareData(data);
    } catch (err) {
      console.error('Failed to load family share:', err);
    } finally {
      setLoadingShare(false);
    }
  };

  useEffect(() => {
    loadShareData();
  }, []);

  // Handle Podcast Generation
  const handleGeneratePodcast = async () => {
    try {
      setGeneratingPodcast(true);
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      const res = await api.podcast.generate({
        era: selectedEra,
        voice_name: selectedVoice,
        duration_mode: selectedDuration,
      });

      setPodcastEpisode(res);
      setPlaybackTime(0);
    } catch (err) {
      alert(err.message || 'Failed to generate audio memoir podcast.');
    } finally {
      setGeneratingPodcast(false);
    }
  };

  // Audio Playback Controls
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlaybackTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setAudioDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setPlaybackTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Download Audio Episode File
  const handleDownloadAudio = () => {
    if (!podcastEpisode?.audio_base64) return;
    const byteCharacters = atob(podcastEpisode.audio_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: podcastEpisode.mime_type || 'audio/wav' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podcastEpisode.title.replace(/\s+/g, '_')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy share URL
  const handleCopyLink = () => {
    if (!shareData?.share_token) return;
    const fullUrl = `${window.location.origin}/?share=${shareData.share_token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Toggle active or chat permissions
  const handleToggleShareSetting = async (field, value) => {
    if (!shareData?.share_token) return;
    try {
      setUpdatingShare(true);
      const payload = { [field]: value };
      const updated = await api.family.updateShare(shareData.share_token, payload);
      setShareData(updated);
    } catch (err) {
      alert(err.message || 'Failed to update share settings.');
    } finally {
      setUpdatingShare(false);
    }
  };

  // Regenerate secret token
  const handleRegenerateToken = async () => {
    if (!shareData?.share_token) return;
    if (!window.confirm('Regenerating will revoke the previous link. Anyone with the old link will lose access. Continue?')) {
      return;
    }
    try {
      setUpdatingShare(true);
      const updated = await api.family.regenerateToken(shareData.share_token);
      setShareData(updated);
    } catch (err) {
      alert(err.message || 'Failed to regenerate token.');
    } finally {
      setUpdatingShare(false);
    }
  };

  const formatSeconds = (sec) => {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
          <Sparkles size={14} /> Stage 16 Innovation
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.8px', marginBottom: '8px' }}>
          Audio Memoir Podcast & Family Sharing Hub
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '720px', lineHeight: '1.6' }}>
          Turn your life legacy into a documentary audio podcast narrated by Gemini, or generate private links for family to view and chat with your cognitive replica.
        </p>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div
        style={{
          display: 'inline-flex',
          padding: '6px',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginBottom: '32px',
          gap: '6px',
        }}
      >
        <button
          onClick={() => setActiveSubTab('podcast')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '700',
            backgroundColor: activeSubTab === 'podcast' ? 'var(--accent-primary)' : 'transparent',
            color: activeSubTab === 'podcast' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.18s ease',
            cursor: 'pointer',
          }}
        >
          <Radio size={16} /> Audio Memoir Podcast
        </button>

        <button
          onClick={() => setActiveSubTab('family')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '700',
            backgroundColor: activeSubTab === 'family' ? 'var(--accent-primary)' : 'transparent',
            color: activeSubTab === 'family' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.18s ease',
            cursor: 'pointer',
          }}
        >
          <Users size={16} /> Family Sharing Portal
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUDIO MEMOIR PODCAST STUDIO */}
      {/* ========================================================================= */}
      {activeSubTab === 'podcast' && (
        <div>
          <div className="grid-2" style={{ gap: '28px', marginBottom: '32px' }}>
            {/* Left: Podcast Generator Config */}
            <div className="card" style={{ padding: '28px', borderRadius: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Disc size={20} color="var(--accent-primary)" /> Configure Episode
              </h3>

              {/* Voice Persona Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Narrator Voice Persona
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {VOICES.map((v) => {
                    const isSelected = selectedVoice === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVoice(v.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                          border: isSelected ? '1px solid #818cf8' : '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>{v.icon}</span>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                              {v.label}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.desc}</div>
                          </div>
                        </div>
                        {isSelected && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#818cf8' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Duration Mode */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Episode Format
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDuration('standard')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '700',
                      backgroundColor: selectedDuration === 'standard' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                      border: selectedDuration === 'standard' ? '1px solid #818cf8' : '1px solid var(--border-color)',
                      color: selectedDuration === 'standard' ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Standard Memoir (3-5 min)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDuration('highlight')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '700',
                      backgroundColor: selectedDuration === 'highlight' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                      border: selectedDuration === 'highlight' ? '1px solid #818cf8' : '1px solid var(--border-color)',
                      color: selectedDuration === 'highlight' ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Highlight Reel (1-2 min)
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <button
                className="btn btn-primary"
                onClick={handleGeneratePodcast}
                disabled={generatingPodcast}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontWeight: '700',
                  fontSize: '15px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)',
                }}
              >
                {generatingPodcast ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <RefreshCw size={16} className="spin" /> Gemini is Weaving Audio Story...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Radio size={16} /> Produce Audio Memoir Episode
                  </span>
                )}
              </button>
            </div>

            {/* Right: Audio Player / Vinyl Studio */}
            <div
              className="card"
              style={{
                padding: '28px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              {/* Spinning Vinyl Graphic */}
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #1e293b 25%, #0f172a 60%, #020617 100%)',
                  border: '6px solid rgba(129, 140, 248, 0.35)',
                  boxShadow: isPlaying
                    ? '0 0 35px rgba(129, 140, 248, 0.6), inset 0 0 20px rgba(99, 102, 241, 0.5)'
                    : '0 10px 25px rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  animation: isPlaying ? 'spin 6s linear infinite' : 'none',
                }}
              >
                <div
                  style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #c084fc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <Disc size={22} />
                </div>
              </div>

              <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                {podcastEpisode ? podcastEpisode.title : 'Audio Memoir Documentary'}
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', maxWidth: '340px' }}>
                {podcastEpisode
                  ? `Narrated by ${podcastEpisode.voice_name} • ${podcastEpisode.chapters_count} Chapters Compiled`
                  : 'Configure narrator and click Produce to generate your personalized audio episode.'}
              </p>

              {podcastEpisode?.audio_base64 && (
                <div style={{ width: '100%', maxWidth: '380px' }}>
                  <audio
                    ref={audioRef}
                    src={`data:${podcastEpisode.mime_type || 'audio/wav'};base64,${podcastEpisode.audio_base64}`}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                    style={{ display: 'none' }}
                  />

                  {/* Playback Seek Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '32px' }}>
                      {formatSeconds(playbackTime)}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={audioDuration || 100}
                      value={playbackTime}
                      onChange={handleSeek}
                      style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '32px' }}>
                      {formatSeconds(audioDuration)}
                    </span>
                  </div>

                  {/* Control Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <button
                      onClick={togglePlayAudio}
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 6px 20px rgba(99, 102, 241, 0.5)',
                        cursor: 'pointer',
                      }}
                    >
                      {isPlaying ? <Pause size={22} /> : <Play size={22} style={{ marginLeft: '3px' }} />}
                    </button>

                    <button
                      onClick={handleDownloadAudio}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Download audio file"
                    >
                      <Download size={14} /> Download Audio
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Read-Along Transcript Viewer */}
          {podcastEpisode?.script && (
            <div className="card" style={{ padding: '28px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Volume2 size={16} color="var(--accent-primary)" /> Read-Along Documentary Script
                </h3>
                <span className="badge badge-info" style={{ fontSize: '11px' }}>
                  {podcastEpisode.script.split(/\s+/).length} spoken words
                </span>
              </div>
              <div
                style={{
                  fontSize: '15px',
                  lineHeight: '1.8',
                  color: '#e2e8f0',
                  backgroundColor: 'rgba(2, 6, 23, 0.5)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  whiteSpace: 'pre-line',
                }}
              >
                {podcastEpisode.script}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FAMILY SHARING PORTAL HUB */}
      {/* ========================================================================= */}
      {activeSubTab === 'family' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Share Link Banner Card */}
          <div
            className="card"
            style={{
              padding: '30px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span className="badge badge-info" style={{ marginBottom: '8px', display: 'inline-block' }}>
                  <Shield size={12} style={{ marginRight: '4px' }} /> Secure Public Guest Access
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>
                  Secret Family Share Link
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Anyone with this link can view your milestones and converse with your replica without creating an account.
                </p>
              </div>

              {/* Total Views Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <Eye size={16} color="#38bdf8" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>
                  {shareData?.views_count || 0} Family Visits
                </span>
              </div>
            </div>

            {/* Link Copy Box */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' }}>
              <input
                type="text"
                readOnly
                value={shareData?.share_token ? `${window.location.origin}/?share=${shareData.share_token}` : 'Generating link...'}
                style={{
                  flex: 1,
                  minWidth: '260px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#38bdf8',
                  backgroundColor: 'rgba(2, 6, 23, 0.8)',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                }}
              />
              <button
                className="btn btn-primary"
                onClick={handleCopyLink}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px', fontWeight: '700' }}
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Link'}</span>
              </button>
              <a
                href={shareData?.share_token ? `/?share=${shareData.share_token}` : '#'}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 18px' }}
              >
                <ExternalLink size={15} /> Preview Portal
              </a>
            </div>

            {/* Permission Toggles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
              {/* Toggle Active */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Portal Status</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {shareData?.is_active ? 'Live & accessible' : 'Paused / disabled'}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleShareSetting('is_active', !shareData?.is_active)}
                  disabled={updatingShare}
                  className={`badge ${shareData?.is_active ? 'badge-success' : 'badge-danger'}`}
                  style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '12px' }}
                >
                  {shareData?.is_active ? 'Published' : 'Paused'}
                </button>
              </div>

              {/* Toggle Chat */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Family Guest Chat</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Allow guests to talk with replica</div>
                </div>
                <button
                  onClick={() => handleToggleShareSetting('allow_chat', !shareData?.allow_chat)}
                  disabled={updatingShare}
                  className={`badge ${shareData?.allow_chat ? 'badge-info' : 'badge-warning'}`}
                  style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '12px' }}
                >
                  {shareData?.allow_chat ? 'Chat Allowed' : 'Chat Paused'}
                </button>
              </div>
            </div>

            {/* Danger: Regenerate Link */}
            <div style={{ marginTop: '22px', textAlign: 'right' }}>
              <button
                onClick={handleRegenerateToken}
                disabled={updatingShare}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Regenerate secret link (revokes previous URL)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

