import { useNavigate } from 'react-router-dom'

function Navbar({ user, onLogout, activeTab, onTabChange, showTabs = true, tabLabels = null, showHistoryTab = false, showManagementTab = false }) {
  const navigate = useNavigate()

  const labels = tabLabels || {
    dashboard: 'Dashboard',
    students: 'Öğrenciler',
    history: 'Geçmiş',
    management: 'Yönetim'
  }

  const handleLogoClick = () => {
    if (user?.role === 'admin') {
      navigate('/admin')
    } else {
      navigate('/teacher')
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-brand" onClick={handleLogoClick}>
          <div className="university-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="6" fill="#f8f8f8ff" />
              <path d="M8 12L16 8L24 12V20L16 24L8 20V12Z" stroke="white" strokeWidth="2" fill="none" />
              <path d="M12 14L16 12L20 14V18L16 20L12 18V14Z" fill="white" />
            </svg>
          </div>
          <div className="university-name">
            <div style={{ fontSize: '14px', fontWeight: '600', letterSpacing: '0.5px' }}>ACIBADEM</div>
            <div style={{ fontSize: '11px', fontWeight: '400', opacity: 0.9 }}>ÜNİVERSİTESİ</div>
          </div>
        </div>
      </div>

      <div className="navbar-right">
        {showTabs && onTabChange && (
          <div className="nav-tabs">
            {/* First tab: dashboard for admin, form for teacher */}
            {showHistoryTab ? (
              // Admin mode: goes to dashboard
              <TabButton
                active={activeTab === 'dashboard'}
                onClick={() => onTabChange('dashboard')}
              >
                {labels.dashboard}
              </TabButton>
            ) : (
              // Teacher mode: goes to form
              <TabButton
                active={activeTab === 'form'}
                onClick={() => onTabChange('form')}
              >
                {labels.dashboard}
              </TabButton>
            )}

            {/* Second tab: students or history depending on mode */}
            {showHistoryTab ? (
              // Admin mode: show both students and history tabs
              <>
                <TabButton active={activeTab === 'students'} onClick={() => onTabChange('students')}>
                  {labels.students}
                </TabButton>
                <TabButton active={activeTab === 'history'} onClick={() => onTabChange('history')}>
                  {labels.history}
                </TabButton>
              </>
            ) : (
              // Teacher mode: single tab for history
              <TabButton active={activeTab === 'history'} onClick={() => onTabChange('history')}>
                {labels.students}
              </TabButton>
            )}

            {/* Management tab (admin only) */}
            {showManagementTab && (
              <TabButton active={activeTab === 'management'} onClick={() => onTabChange('management')}>
                {labels.management}
              </TabButton>
            )}
          </div>
        )}

        <div className="navbar-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            </svg>
            <span className="nav-username">{user?.username}</span>
          </div>
          <button onClick={onLogout} className="btn-logout" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Çıkış
          </button>
        </div>
      </div>
    </nav>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`nav-tab ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  )
}

export default Navbar
