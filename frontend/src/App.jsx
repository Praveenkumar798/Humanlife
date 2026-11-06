import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import PwaInstallBanner from './components/PwaInstallBanner';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import LibraryPage from './pages/LibraryPage';
import MemoryDetailPage from './pages/MemoryDetailPage';
import UploadPage from './pages/UploadPage';
import ChatPage from './pages/ChatPage';
import VoicePage from './pages/VoicePage';
import BiographerPage from './pages/BiographerPage';
import PodcastFamilyPage from './pages/PodcastFamilyPage';
import PublicLegacyPage from './pages/PublicLegacyPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const { user, loading } = useAuth();

  // Handle public family share link without requiring login
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');
  if (shareToken) {
    return <PublicLegacyPage shareToken={shareToken} />;
  }

  // Navigation state for unauthenticated flow: 'landing', 'login', 'register'
  const [authView, setAuthView] = useState('landing');

  // Navigation state for authenticated app: 'dashboard', 'library', 'memory-detail', 'upload', 'chat', 'voice', 'settings'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);

  const navigateTo = (tab, params = {}) => {
    if (params.memoryId) setSelectedMemoryId(params.memoryId);
    if (params.conversationId) setSelectedConversationId(params.conversationId);
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-muted)',
        fontSize: '15px'
      }}>
        Initializing Human Legacy Archive...
      </div>
    );
  }

  // Unauthenticated experience
  if (!user) {
    if (authView === 'login') {
      return (
        <LoginPage
          onGoRegister={() => setAuthView('register')}
          onLoginSuccess={() => setActiveTab('dashboard')}
        />
      );
    }
    if (authView === 'register') {
      return (
        <RegisterPage
          onGoLogin={() => setAuthView('login')}
          onRegisterSuccess={() => setActiveTab('dashboard')}
        />
      );
    }
    return (
      <LandingPage
        onGoLogin={() => setAuthView('login')}
        onGoRegister={() => setAuthView('register')}
      />
    );
  }

  // Authenticated Application experience
  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardPage onNavigate={navigateTo} />}
        {activeTab === 'library' && <LibraryPage onNavigate={navigateTo} />}
        {activeTab === 'memory-detail' && (
          <MemoryDetailPage
            memoryId={selectedMemoryId}
            onNavigate={navigateTo}
          />
        )}
        {activeTab === 'upload' && <UploadPage onNavigate={navigateTo} />}
        {activeTab === 'chat' && (
          <ChatPage
            initialConversationId={selectedConversationId}
            onNavigate={navigateTo}
          />
        )}
        {activeTab === 'voice' && <VoicePage onNavigate={navigateTo} />}
        {activeTab === 'biographer' && <BiographerPage onNavigate={navigateTo} />}
        {activeTab === 'family-podcast' && <PodcastFamilyPage onNavigate={navigateTo} />}
        {activeTab === 'settings' && <SettingsPage onNavigate={navigateTo} />}
      </main>
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <PwaInstallBanner />
    </div>
  );
}

