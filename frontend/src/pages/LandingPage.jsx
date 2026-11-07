import React, { useState } from 'react';
import {
  BrainCircuit,
  ShieldCheck,
  Sparkles,
  Mic,
  FileText,
  ArrowRight,
  Headphones,
  Users,
  Lock,
  Globe2,
  ChevronDown,
  ChevronUp,
  Volume2,
  Play,
  Heart,
  CheckCircle2,
  Layers,
  Share2
} from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';
import AmbientVideoMotion from '../components/AmbientVideoMotion';
import HeroVideoPlayer from '../components/HeroVideoPlayer';

export default function LandingPage({ onGoLogin, onGoRegister }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [selectedLang, setSelectedLang] = useState('te');
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);

  // Play Spoken Voice Sample using Web SpeechSynthesis
  const playVoiceSample = (text, langCode) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (isPlayingDemo) {
      setIsPlayingDemo(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = { te: 'te-IN', hi: 'hi-IN', en: 'en-US' };
    utterance.lang = langMap[langCode] || 'en-US';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(langCode));
    if (matchedVoice) utterance.voice = matchedVoice;

    utterance.onstart = () => setIsPlayingDemo(true);
    utterance.onend = () => setIsPlayingDemo(false);
    utterance.onerror = () => setIsPlayingDemo(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const demoPhrases = {
    te: {
      lang: 'తెలుగు (Telugu)',
      userQ: 'నాన్నగారూ, మీ మొదటి ఉద్యోగం అనుభవం ఎలా ఉండేది?',
      aiAns: '1998 లో నేను హైదరాబాద్‌కు మొదటిసారి వచ్చినప్పుడు నా దగ్గర కేవలం ఒక బ్యాగ్ మాత్రమే ఉంది. ఆ రోజుల్లో హార్డ్‌వర్క్ ఒక్కటే నన్ను ముందుకు నడిపించింది...',
      context: 'Based on Memory #14: Early Career in Hyderabad (1998)'
    },
    hi: {
      lang: 'हिन्दी (Hindi)',
      userQ: 'पापा, आपने जीवन में सबसे बड़ा निर्णय कब लिया था?',
      aiAns: '2005 में जब मैंने अपनी सरकारी नौकरी छोड़कर खुद का व्यवसाय शुरू करने का फैसला किया, तब पूरा परिवार डरा हुआ था। लेकिन मेरा विश्वास पक्का था...',
      context: 'Based on Memory #8: Entrepreneurship Journey (2005)'
    },
    en: {
      lang: 'English',
      userQ: 'Dad, what was your most cherished principle for raising kids?',
      aiAns: 'Always lead by empathy before discipline. You kids never learned from what I preached, but from how I treated everyday people with kindness...',
      context: 'Based on Memory #22: Family Ethics & Raising Children'
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Ambient Looping Video Motion & Neural Constellation Starfield */}
      <AmbientVideoMotion />
      
      {/* 1. Header Navigation */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(7, 10, 19, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '16px 28px',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <BrainCircuit size={22} />
            </div>
            <div>
              <span style={{ fontSize: '19px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                Human Legacy AI
              </span>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                COGNITIVE REPLICA & MEMOIR
              </span>
            </div>
          </div>

          {/* Center Links (Desktop) */}
          <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }} className="hidden-mobile">
            <a href="#features" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>Features</a>
            <a href="#voice" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>Telugu & Hindi Voice</a>
            <a href="#podcast" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>Audio Memoir</a>
            <a href="#pricing" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>Pricing</a>
            <a href="#faq" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>FAQ</a>
          </nav>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={onGoLogin}
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '8px 18px' }}
            >
              Sign In
            </button>
            <button
              onClick={onGoRegister}
              className="btn btn-primary"
              style={{ fontSize: '13px', padding: '8px 20px' }}
            >
              Start Free Vault
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section style={{
        position: 'relative',
        padding: '80px 20px 60px',
        textAlign: 'center',
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Multilingual Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: '#a5b4fc',
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '24px'
        }}>
          <Sparkles size={15} color="#818cf8" />
          <span>Telugu, Hindi & English Multimodal Voice Replica</span>
        </div>

        {/* Hero Headline */}
        <h1 style={{
          fontSize: 'clamp(34px, 5.5vw, 62px)',
          fontWeight: '800',
          lineHeight: '1.15',
          letterSpacing: '-1.5px',
          marginBottom: '24px',
          maxWidth: '960px'
        }}>
          Preserve your voice, wisdom, and life stories{' '}
          <span style={{
            background: 'var(--gradient-brand)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            for generations to come.
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)',
          color: 'var(--text-secondary)',
          maxWidth: '780px',
          lineHeight: '1.6',
          marginBottom: '36px'
        }}>
          Human Legacy AI turns your personal stories, voice journals, and family values into an interactive AI cognitive replica and biographical audio podcasts for your children and grandchildren.
        </p>

        {/* Hero CTAs */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          width: '100%',
          maxWidth: '480px',
          marginBottom: '32px'
        }}>
          {/* 1-Click Google Sign-In */}
          <div style={{ width: '100%' }}>
            <GoogleSignInButton onSuccess={onGoRegister} width={360} text="continue_with" />
          </div>

          <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
            <button
              onClick={onGoRegister}
              className="btn btn-primary"
              style={{ flex: 1, padding: '14px 24px', fontSize: '15px', fontWeight: '600' }}
            >
              Start Free Vault <ArrowRight size={18} />
            </button>
            <button
              onClick={onGoLogin}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '14px 20px', fontSize: '15px' }}
            >
              Access Vault
            </button>
          </div>
        </div>

        {/* Trust Badges */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '24px',
          fontSize: '13px',
          color: 'var(--text-muted)',
          marginBottom: '40px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="var(--success)" />
            <span>100% Private & Encrypted</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} color="var(--accent-primary)" />
            <span>Zero Hallucination RAG</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe2 size={16} color="#ec4899" />
            <span>తెలుగు & हिन्दी Native Voice</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Heart size={16} color="#ef4444" />
            <span>Free Forever Starter</span>
          </div>
        </div>

        {/* 3. Hero Video Motion Player */}
        <div style={{ width: '100%', marginBottom: '40px' }}>
          <HeroVideoPlayer onGetStarted={onGoRegister} />
        </div>

        {/* 4. Interactive Hero Preview Mockup */}
        <div style={{
          width: '100%',
          maxWidth: '980px',
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), var(--shadow-glow)',
          overflow: 'hidden',
          textAlign: 'left'
        }}>
          {/* Mockup Header Bar */}
          <div style={{
            padding: '14px 20px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>
                Human Legacy AI — Interactive Cognitive Replica Session
              </span>
            </div>

            {/* Language Switcher Pills */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['te', 'hi', 'en'].map((code) => (
                <button
                  key={code}
                  onClick={() => setSelectedLang(code)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    border: '1px solid',
                    borderColor: selectedLang === code ? 'var(--accent-primary)' : 'transparent',
                    backgroundColor: selectedLang === code ? 'var(--accent-light)' : 'rgba(255, 255, 255, 0.05)',
                    color: selectedLang === code ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {code === 'te' ? 'తెలుగు' : code === 'hi' ? 'हिन्दी' : 'English'}
                </button>
              ))}
            </div>
          </div>

          {/* Mockup Content Grid */}
          <div style={{ padding: '28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Left: Memory Vault Preview */}
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Mic size={18} color="var(--accent-primary)" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Biographer Voice Journal
                </span>
                <span className="badge badge-success" style={{ fontSize: '10px', marginLeft: 'auto' }}>
                  Verified
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                "{demoPhrases[selectedLang].context}"
              </p>
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Volume2 size={14} color="#10b981" />
                <span>Audio Waveform Synced with pgvector Embeddings</span>
              </div>
            </div>

            {/* Right: Live Replica Conversation */}
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Grandchild's Question */}
              <div style={{
                alignSelf: 'flex-end',
                backgroundColor: 'rgba(99, 102, 241, 0.25)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '14px 14px 2px 14px',
                padding: '10px 14px',
                maxWidth: '90%',
                fontSize: '13px'
              }}>
                <div style={{ fontSize: '10px', color: '#a5b4fc', fontWeight: '600', marginBottom: '2px' }}>
                  Grandchild Spoken Question
                </div>
                {demoPhrases[selectedLang].userQ}
              </div>

              {/* Cognitive Replica Answer */}
              <div style={{
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px 14px 14px 2px',
                padding: '12px 14px',
                maxWidth: '95%',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <BrainCircuit size={12} color="#10b981" />
                  <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>
                    Cognitive Replica (Gemini Live Spoken Voice)
                  </span>
                </div>
                <p style={{ margin: '6px 0 12px 0' }}>{demoPhrases[selectedLang].aiAns}</p>

                {/* Animated Audio Equalizer Wave & Interactive Voice Player */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  {/* Dancing Audio Equalizer Waveform */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '24px' }}>
                    {[12, 22, 16, 28, 14, 26, 18, 30, 15, 24, 10, 20].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: '3px',
                          height: isPlayingDemo ? `${h}px` : '4px',
                          backgroundColor: isPlayingDemo ? 'var(--accent-primary)' : 'var(--text-muted)',
                          borderRadius: '2px',
                          transition: 'height 0.2s ease',
                          animation: isPlayingDemo ? `audioBarWave 0.8s ease-in-out infinite ${i * 0.07}s` : 'none'
                        }}
                      />
                    ))}
                    <span style={{ fontSize: '11px', color: isPlayingDemo ? '#818cf8' : 'var(--text-muted)', marginLeft: '6px' }}>
                      {isPlayingDemo ? 'Speaking in Native Voice...' : 'Ready to Speak'}
                    </span>
                  </div>

                  {/* Play Voice Sample Button */}
                  <button
                    type="button"
                    onClick={() => playVoiceSample(demoPhrases[selectedLang].aiAns, selectedLang)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: isPlayingDemo ? '#ef4444' : 'var(--accent-primary)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isPlayingDemo ? <Volume2 size={13} /> : <Play size={13} fill="#fff" />}
                    <span>{isPlayingDemo ? 'Stop Voice' : `Play ${selectedLang.toUpperCase()} Sample`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features Showcase */}
      <section id="features" style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '14px' }}>
            Built for Real Families & Future Generations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '640px', margin: '0 auto' }}>
            Every capability is designed to preserve authentic wisdom, voice, and memories without artificial hallucinations.
          </p>
        </div>

        <div className="grid-3" style={{ gap: '24px' }}>
          {/* Card 1: Multilingual Voice */}
          <div className="card" id="voice" style={{ padding: '28px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              marginBottom: '16px'
            }}>
              <Globe2 size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
              Multilingual Spoken AI (తెలుగు / हिन्दी / English)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Talk naturally in Telugu, Hindi, or English. Gemini Live API provides real-time spoken audio conversation matching your native rhythm and family dialect.
            </p>
          </div>

          {/* Card 2: Biographer */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)',
              marginBottom: '16px'
            }}>
              <Mic size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
              Conversational Biographer
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Don't know where to start? The AI Biographer asks reflective questions about your childhood, career, weddings, and life lessons, capturing memories automatically.
            </p>
          </div>

          {/* Card 3: Audio Memoir Podcast */}
          <div className="card" id="podcast" style={{ padding: '28px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
              marginBottom: '16px'
            }}>
              <Headphones size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
              Stage 16 Audio Memoir Podcast
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Transform your written memories into a professional multi-voice broadcast podcast with host commentary, biographical narration, and downloadable audio.
            </p>
          </div>

          {/* Card 4: Family Sharing */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(236, 72, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f472b6',
              marginBottom: '16px'
            }}>
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
              Tokenized Family Tribute Portal
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Share a secure, read-only tribute link with relatives and grandkids. They can listen to your stories and chat with your replica without creating an account.
            </p>
          </div>

          {/* Card 5: Documents & Journals */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(14, 165, 233, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              marginBottom: '16px'
            }}>
              <FileText size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
              PDF, Diary & Certificate Ingestion
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Upload handwritten diary scans, letters, and PDF documents. They are vectorized with precise page citations so every answer points back to original evidence.
            </p>
          </div>

          {/* Card 6: Absolute Privacy */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning)',
              marginBottom: '16px'
            }}>
              <Lock size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
              Zero Hallucination & Bank Privacy
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Your private family memories are never sold or used for generic model training. If a fact isn't in your vault, the AI truthfully states it doesn't know.
            </p>
          </div>
        </div>
      </section>

      {/* 5. How It Works Section */}
      <section style={{
        padding: '70px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '40px' }}>
            How It Works in 3 Simple Steps
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '30px', textAlign: 'left' }}>
            <div style={{ padding: '20px' }}>
              <div style={{
                fontSize: '32px',
                fontWeight: '900',
                color: 'var(--accent-primary)',
                marginBottom: '12px'
              }}>
                01
              </div>
              <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Speak or Upload</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Open the app on mobile or desktop. Talk freely in Telugu, Hindi, or English or upload diaries and letters.
              </p>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{
                fontSize: '32px',
                fontWeight: '900',
                color: 'var(--success)',
                marginBottom: '12px'
              }}>
                02
              </div>
              <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>AI Vectorizes & Verifies</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Our backend indexes memories into pgvector embeddings with timeline categories, life stages, and citation tags.
              </p>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{
                fontSize: '32px',
                fontWeight: '900',
                color: '#c084fc',
                marginBottom: '12px'
              }}>
                03
              </div>
              <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Reconnect Forever</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Kids and grandkids ask life questions, receive spoken advice in your authentic voice, and listen to memoir podcasts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Pricing Section */}
      <section id="pricing" style={{ padding: '80px 20px', maxWidth: '960px', margin: '0 auto', textAlign: 'center', width: '100%' }}>
        <h2 style={{ fontSize: '34px', fontWeight: '800', marginBottom: '12px' }}>
          Simple, Transparent Pricing
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '46px' }}>
          Start preserving memories today. Upgrade anytime as your family archive grows.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '28px', textAlign: 'left' }}>
          {/* Free Plan */}
          <div className="card" style={{ padding: '36px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Starter Vault</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Perfect for getting started and recording foundational memories.
            </p>
            <div style={{ fontSize: '36px', fontWeight: '800', marginBottom: '24px' }}>
              ₹0 <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '400' }}>/ Forever Free</span>
            </div>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Up to 10 Preserved Memories
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Spoken Voice in Telugu, Hindi & English
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Unlimited Text RAG Chat
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--success)" /> PDF & TXT Document Ingestion
              </li>
            </ul>

            <button
              onClick={onGoRegister}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', marginTop: 'auto', fontWeight: '600' }}
            >
              Get Started Free
            </button>
          </div>

          {/* Pro Legacy Plan */}
          <div className="card" style={{
            padding: '36px',
            display: 'flex',
            flexDirection: 'column',
            border: '2px solid var(--accent-primary)',
            boxShadow: 'var(--shadow-glow)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '24px',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: '700'
            }}>
              MOST POPULAR FOR FAMILIES
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Family Legacy Pro</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Complete biographical memoir and unlimited multi-generational voice replica.
            </p>
            <div style={{ fontSize: '36px', fontWeight: '800', marginBottom: '24px' }}>
              ₹499 <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '400' }}>/ month</span>
            </div>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--accent-primary)" /> <strong>Unlimited Memories & Life Stories</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--accent-primary)" /> <strong>Unlimited Telugu/Hindi Voice Chat</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--accent-primary)" /> <strong>Stage 16 Audio Memoir Podcast Generator</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--accent-primary)" /> <strong>Tokenized Family Tribute Portal Sharing</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--accent-primary)" /> High-Priority Gemini Live WebSocket Access
              </li>
            </ul>

            <button
              onClick={onGoRegister}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: 'auto', fontWeight: '600' }}
            >
              Start 14-Day Free Trial
            </button>
          </div>
        </div>
      </section>

      {/* 7. FAQ Accordion */}
      <section id="faq" style={{ padding: '70px 20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ fontSize: '30px', fontWeight: '800', textAlign: 'center', marginBottom: '36px' }}>
          Frequently Asked Questions
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            {
              q: 'Is my personal voice and family memory data private?',
              a: 'Yes, 100%. Your memories and audio recordings are stored in a private, encrypted PostgreSQL database with row-level ownership. They are never sold, indexed by public search engines, or used to train third-party public models.'
            },
            {
              q: 'How does Telugu and Hindi voice conversation work?',
              a: 'We leverage Google Gemini Multimodal Live API integrated with specialized Indic linguistic directives. You can speak naturally in Telugu, Hindi, or English; the system detects your dialect, responds with grounded memory facts, and speaks back in authentic native tones.'
            },
            {
              q: 'What is the Stage 16 Audio Memoir Podcast?',
              a: 'It is an automated audio production engine. It analyzes your verified life stories, creates a dynamic radio script with narrator commentary, and produces a broadcast-quality audio episode that your family can download or stream.'
            },
            {
              q: 'Can I install this on my Android phone or iPhone?',
              a: 'Yes! Human Legacy AI is a Progressive Web App (PWA). You can tap "Install App" or "Add to Home Screen" from your mobile browser, and it will function seamlessly like a native mobile app with full microphone and audio support.'
            }
          ].map((faq, idx) => (
            <div
              key={idx}
              className="card"
              style={{ padding: '18px 22px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => toggleFaq(idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: '600', fontSize: '15px' }}>
                <span>{faq.q}</span>
                {activeFaq === idx ? <ChevronUp size={18} color="var(--accent-primary)" /> : <ChevronDown size={18} />}
              </div>
              {activeFaq === idx && (
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 8. Footer */}
      <footer style={{
        marginTop: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderTop: '1px solid var(--border-color)',
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BrainCircuit size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Human Legacy AI</span>
            <span>— Cognitive Preservation Platform</span>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <span style={{ cursor: 'pointer' }} onClick={onGoLogin}>Sign In</span>
            <span style={{ cursor: 'pointer' }} onClick={onGoRegister}>Register</span>
            <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</a>
            <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</a>
          </div>

          <div>
            © 2026 Human Legacy AI. Preserving human wisdom forever.
          </div>
        </div>
      </footer>

    </div>
  );
}
