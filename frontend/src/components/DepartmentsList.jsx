import { useState, useEffect } from 'react'
import { managementAPI } from '../services/api'
import DepartmentModal from './DepartmentModal'

function DepartmentsList({ showToast }) {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  const loadDepartments = async () => {
    setLoading(true)
    try {
      const data = await managementAPI.getDepartments({ active_only: !showInactive })
      setDepartments(data)
    } catch (e) {
      console.error('Failed to load departments:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDepartments()
  }, [showInactive])

  const handleCreate = () => {
    setEditingDept(null)
    setShowModal(true)
  }

  const handleEdit = (dept) => {
    setEditingDept(dept)
    setShowModal(true)
  }

  const handleSave = async (deptData) => {
    setActionLoading(true)
    try {
      if (editingDept) {
        await managementAPI.updateDepartment(editingDept.id, deptData)
        showToast('Bölüm güncellendi', 'success')
      } else {
        await managementAPI.createDepartment(deptData)
        showToast('Bölüm oluşturuldu', 'success')
      }
      setShowModal(false)
      loadDepartments()
    } catch (e) {
      const errorMsg = e.response?.data?.detail || 'İşlem başarısız'
      showToast(Array.isArray(errorMsg) ? errorMsg.map(e => e.msg).join(', ') : errorMsg, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = (dept) => {
    setDeleteConfirm(dept)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    setActionLoading(true)
    try {
      await managementAPI.deleteDepartment(deleteConfirm.id)
      showToast('Bölüm silindi', 'success')
      setDeleteConfirm(null)
      loadDepartments()
    } catch (e) {
      const errorMsg = e.response?.data?.detail || 'Silme işlemi başarısız'
      showToast(errorMsg, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const toggleActive = async (dept) => {
    setActionLoading(true)
    try {
      await managementAPI.updateDepartment(dept.id, { active: !dept.active })
      showToast(`Bölüm ${dept.active ? 'pasife' : 'aktife'} alındı`, 'success')
      loadDepartments()
    } catch (e) {
      const errorMsg = e.response?.data?.detail || 'İşlem başarısız'
      showToast(errorMsg, 'error')
    } finally {
      setActionLoading(false)
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
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Bölümler</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>{departments.length} bölüm</p>
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
          Yeni Bölüm
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '13px', color: '#475569' }}>Pasif bölümleri göster</span>
        </label>
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
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bölüm Adı</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Telegram Chat ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Durum</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Öğrenci Sayısı</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>Bölüm bulunamadı</p>
                </td>
              </tr>
            ) : departments.map((dept) => (
              <tr
                key={dept.id}
                style={{ borderBottom: '1px solid #F1F5F9', opacity: dept.active ? 1 : 0.6 }}
              >
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#0F172A' }}>
                    {dept.name}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    fontSize: '13px',
                    color: dept.telegram_chat_id ? '#475569' : '#CBD5E1',
                    fontFamily: dept.telegram_chat_id ? 'monospace' : 'inherit'
                  }}>
                    {dept.telegram_chat_id || '-'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <button
                    onClick={() => toggleActive(dept)}
                    disabled={actionLoading}
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: dept.active ? '#DCFCE7' : '#F1F5F9',
                      color: dept.active ? '#166534' : '#64748B',
                      border: 'none',
                      cursor: actionLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {dept.active ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: '14px', color: '#475569' }}>
                    {dept.student_count || 0}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleEdit(dept)}
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
                      onClick={() => handleDelete(dept)}
                      disabled={dept.student_count > 0 || actionLoading}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: dept.student_count > 0 ? '#CBD5E1' : '#EF4444',
                        background: dept.student_count > 0 ? '#F1F5F9' : '#FEF2F2',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: dept.student_count > 0 || actionLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Department Modal */}
      {showModal && (
        <DepartmentModal
          department={editingDept}
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
              Bölümü Sil
            </h3>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 20px 0' }}>
              "{deleteConfirm.name}" bölümünü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            {deleteConfirm.student_count > 0 && (
              <div style={{
                padding: '12px',
                background: '#FEF3C7',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#92400E'
              }}>
                Bu bölümde {deleteConfirm.student_count} öğrenci kayıtlı. Önce öğrencileri başka bölüme atamanız gerekiyor.
              </div>
            )}
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
                disabled={actionLoading || deleteConfirm.student_count > 0}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  background: (actionLoading || deleteConfirm.student_count > 0) ? '#94A3B8' : '#EF4444',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (actionLoading || deleteConfirm.student_count > 0) ? 'not-allowed' : 'pointer'
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

export default DepartmentsList
