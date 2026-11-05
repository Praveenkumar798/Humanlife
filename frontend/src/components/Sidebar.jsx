import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  MessageSquare,
  Mic,
  Settings,
  LogOut,
  BrainCircuit,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Memory Library', icon: BookOpen },
    { id: 'biographer', label: 'AI Biographer', icon: Sparkles, badge: 'New' },
    { id: 'upload', label: 'Upload Documents', icon: Upload },
    { id: 'chat', label: 'AI Text Chat', icon: MessageSquare },
    { id: 'voice', label: 'Voice Assistant', icon: Mic, badge: 'Live' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className="sidebar-desktop"
      style={{
        width: '270px',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 18px',
        zIndex: 50,
      }}
    >
      <div>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 8px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 6px 18px rgba(99, 102, 241, 0.4)',
              flexShrink: 0,
            }}
          >
            <BrainCircuit size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.4px', color: '#fff' }}>
                Human Legacy
              </h2>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={10} /> AI Cognitive Replica
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                  boxShadow: isActive ? '0 4px 14px rgba(99, 102, 241, 0.2)' : 'none',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '14px',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={19} color={isActive ? '#818cf8' : 'currentColor'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer & Logout */}
      <div
        style={{
          paddingTop: '18px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.full_name || user?.username}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
        </div>
        <button
          onClick={logout}
          title="Sign Out"
          style={{
            padding: '8px',
            color: 'var(--text-muted)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--danger)';
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
