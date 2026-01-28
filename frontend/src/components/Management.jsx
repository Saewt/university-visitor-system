import { useState } from 'react'
import UsersList from './UsersList'
import DepartmentsList from './DepartmentsList'

function Management({ showToast, currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('users')

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Sub-tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #E2E8F0',
        paddingBottom: '0'
      }}>
        <button
          onClick={() => setActiveSubTab('users')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            color: activeSubTab === 'users' ? '#0F172A' : '#64748B',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'users' ? '2px solid #0F172A' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Kullanıcılar
        </button>
        <button
          onClick={() => setActiveSubTab('departments')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            color: activeSubTab === 'departments' ? '#0F172A' : '#64748B',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'departments' ? '2px solid #0F172A' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Bölümler
        </button>
      </div>

      {/* Content */}
      {activeSubTab === 'users' && (
        <UsersList showToast={showToast} currentUser={currentUser} />
      )}
      {activeSubTab === 'departments' && (
        <DepartmentsList showToast={showToast} />
      )}
    </div>
  )
}

export default Management
