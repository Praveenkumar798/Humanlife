import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function GoogleSignInButton({ onSuccess, text = 'continue_with', width = 320 }) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleBtnRef = useRef(null);

  // In production, user sets VITE_GOOGLE_CLIENT_ID in Render or .env
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID__;

  useEffect(() => {
    if (!googleClientId) return;

    const initializeGsi = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response) => {
              if (response.credential) {
                setLoading(true);
                setError('');
                try {
                  await loginWithGoogle(response.credential);
                  if (onSuccess) onSuccess();
                } catch (err) {
                  setError(err.message || 'Google sign-in failed. Please try again.');
                } finally {
                  setLoading(false);
                }
              }
            },
            auto_select: false,
          });

          // Render standard Google Sign-In button
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: text,
            width: width,
            logo_alignment: 'left',
          });

          // Also trigger One-Tap prompt on eligible browsers
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // Gracefully continue with normal button
            }
          });
        } catch (e) {
          console.warn('Google GSI initialization warning:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGsi();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          initializeGsi();
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [googleClientId]);

  // Fallback / standard branded button if Client ID not yet supplied in Render env
  const handleDirectClick = async () => {
    if (!googleClientId) {
      setError('Please add VITE_GOOGLE_CLIENT_ID in your Render environment to activate live Google OAuth.');
      return;
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {error && (
        <div style={{
          fontSize: '12px',
          color: '#f87171',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          padding: '8px 12px',
          borderRadius: '8px',
          marginBottom: '10px',
          textAlign: 'center',
          maxWidth: '320px',
          width: '100%',
        }}>
          {error}
        </div>
      )}

      {googleClientId ? (
        <div ref={googleBtnRef} style={{ minHeight: '44px', display: 'flex', justifyContent: 'center' }} />
      ) : (
        <button
          type="button"
          onClick={handleDirectClick}
          disabled={loading}
          style={{
            width: `${width}px`,
            maxWidth: '100%',
            height: '44px',
            backgroundColor: '#ffffff',
            color: '#1f2937',
            border: '1px solid #e5e7eb',
            borderRadius: '9999px',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
        >
          {/* Official Google G Logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>
      )}
    </div>
  );
}

