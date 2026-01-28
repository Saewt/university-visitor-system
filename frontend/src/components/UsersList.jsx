import { useState, useEffect } from 'react'
import { managementAPI } from '../services/api'
import UserModal from './UserModal'

function UsersList({ showToast, currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [filterRole, setFilterRole] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterRole) params.role = filterRole
      const data = await managementAPI.getUsers(params)
      setUsers(data)
    } catch (e) {
      console.error('Failed to load users:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [filterRole])

  const handleCreate = () => {
    setEditingUser(null)
    setShowModal(true)
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setShowModal(true)
  }

  const handleSave = async (userData) => {
    setActionLoading(true)
    try {
      if (editingUser) {
        await managementAPI.updateUser(editingUser.id, userData)
        showToast('Kullanıcı güncellendi', 'success')
      } else {
        await managementAPI.createUser(userData)
        showToast('Kullanıcı oluşturuldu', 'success')
      }
      setShowModal(false)
      loadUsers()
    } catch (e) {
      const errorMsg = e.response?.data?.detail || 'İşlem başarısız'
      showToast(Array.isArray(errorMsg) ? errorMsg.map(e => e.msg).join(', ') : errorMsg, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = (user) => {
    if (user.id === currentUser.id) {
      showToast('Kendi hesabınızı silemezsiniz', 'error')
      return
    }
    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length
      if (adminCount <= 1) {
        showToast('Son yönetici hesabı silinemez', 'error')
        return
      }
    }
    setDeleteConfirm(user)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    setActionLoading(true)
    try {
      await managementAPI.deleteUser(deleteConfirm.id)
      showToast('Kullanıcı silindi', 'success')
      setDeleteConfirm(null)
      loadUsers()
    } catch (e) {
      const errorMsg = e.response?.data?.detail || 'Silme işlemi başarısız'
      showToast(errorMsg, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return {
        background: '#FEF3C7',
        color: '#92400E',
        label: 'Yönetici'
      }
    }
    return {
      background: '#DBEAFE',
      color: '#1E40AF',
      label: 'Öğretmen'
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner spinner-lg"></div>
        <p className="text-muted" style={{ marginTop: '12px' }}>Yükleniyor...</p>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Kullanıcılar</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>{users.length} kullanıcı</p>
        </div>
        <button
          onClick={handleCreate}
          style={{
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'white',
            background: '#0F172A',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Yeni Kullanıcı
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            background: 'white',
            color: '#475569',
            cursor: 'pointer'
          }}
        >
          <option value="">Tüm Roller</option>
          <option value="admin">Yönetici</option>
          <option value="teacher">Öğretmen</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kullanıcı Adı</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rol</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Öğrenci Sayısı</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kayıt Tarihi</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>Kullanıcı bulunamadı</p>
                </td>
              </tr>
            ) : users.map((user) => {
              const badge = getRoleBadge(user.role)
              return (
                <tr
                  key={user.id}
                  style={{ borderBottom: '1px solid #F1F5F9' }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#0F172A' }}>
                      {user.username}
                    </span>
                    {user.id === currentUser.id && (
                      <span style={{
                        fontSize: '11px',
                        color: '#64748B',
                        marginLeft: '8px',
                        fontStyle: 'italic'
                      }}>(Siz)</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: badge.background,
                      color: badge.color
                    }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '14px', color: '#475569' }}>
                      {user.student_count || 0}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      {new Date(user.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleEdit(user)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          color: '#475569',
                          background: '#F1F5F9',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={user.id === currentUser.id || actionLoading}
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          color: user.id === currentUser.id ? '#CBD5E1' : '#EF4444',
                          background: user.id === currentUser.id ? '#F1F5F9' : '#FEF2F2',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: user.id === currentUser.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {showModal && (
        <UserModal
          user={editingUser}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          loading={actionLoading}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 8px 0' }}>
              Kullanıcıyı Sil
            </h3>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 20px 0' }}>
              "{deleteConfirm.username}" kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={actionLoading}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#64748B',
                  background: 'transparent',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                İptal
              </button>
              <button
                onClick={confirmDelete}
                disabled={actionLoading}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  background: actionLoading ? '#94A3B8' : '#EF4444',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default UsersList
