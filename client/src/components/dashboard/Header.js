import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import './Header.css';

const tabs = [
  { id: 'query', label: 'Query', icon: '⚡' },
  { id: 'connections', label: 'Connections', icon: '🔌' },
  { id: 'history', label: 'History', icon: '📋' },
];

export default function Header({ user, activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) {
  const { logout } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <button className="btn btn-ghost btn-icon" onClick={() => setSidebarOpen(v => !v)} title="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect y="2" width="18" height="2" rx="1" fill="currentColor"/>
            <rect y="8" width="12" height="2" rx="1" fill="currentColor"/>
            <rect y="14" width="18" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
        <div className="header-logo">
          <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#4f8ef7" fillOpacity="0.15" />
            <path d="M8 14h5l3-6 4 16 3-8 2 4h3" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>SQLGen</span>
        </div>
      </div>

      <nav className="header-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`header-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="header-right">
        <div className="user-pill">
          <div className="user-avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
          <span className="user-name">{user?.name || user?.email?.split('@')[0]}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}
