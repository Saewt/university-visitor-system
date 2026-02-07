import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, studentsAPI, statsAPI } from '../services/api'
import Navbar from '../components/Navbar'
import OfflineIndicator, { registerToastCallback } from '../components/OfflineIndicator'
import { ToastContainer } from '../components/Toast'
import { getPendingCount } from '../services/offlineStorage'

// Form field order for keyboard navigation
const FORM_FIELD_ORDER = [
  'first_name', 'last_name', 'email', 'phone', 'high_school',
  'ranking', 'yks_score', 'yks_type', 'department_id', 'wants_tour'
]

function TeacherDashboard({ user, onLogout }) {
  const [students, setStudents] = useState([])
  const [offlineStudents, setOfflineStudents] = useState([])
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [toasts, setToasts] = useState([])
  const [newStudentId, setNewStudentId] = useState(null)
  const [activeTab, setActiveTab] = useState('form')
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [mockLoading, setMockLoading] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [expandedCards, setExpandedCards] = useState({})

  // Duplicate detection state
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)

  const navigate = useNavigate()

  const formRef = useRef(null)
  const fieldRefs = useRef({})

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    high_school: '',
    ranking: '',
    yks_score: '',
    yks_type: '',
    department_id: '',
    wants_tour: false,
  })

  const [focusedFields, setFocusedFields] = useState({})

  const [departments, setDepartments] = useState([])

  const loadData = useCallback(async () => {
    try {
      const [studentsResponse, summary] = await Promise.all([
        studentsAPI.getAll({ limit: 50 }),
        statsAPI.getSummary()
      ])
      // Handle new API format: { data: [...], total: N } or legacy array
      const studentsData = studentsResponse.data || studentsResponse
      setStudents(Array.isArray(studentsData) ? studentsData : [])
      setTodayCount(summary.today_count)

      // Also load pending offline students
      updatePendingCount()
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePendingCount = async () => {
    const count = await getPendingCount()
    setPendingCount(count)
    if (count > 0) {
      // Load offline students to show in the list
      const { getPendingStudents } = await import('../services/offlineStorage')
      const pending = await getPendingStudents()
      setOfflineStudents(pending.map(p => ({
        id: `offline-${p.id}`,
        first_name: p.studentData.first_name,
        last_name: p.studentData.last_name,
        email: p.studentData.email,
        phone: p.studentData.phone,
        high_school: p.studentData.high_school,
        department_id: p.studentData.department_id,
        department_name: departments.find(d => d.id === p.studentData.department_id)?.name || '-',
        ranking: p.studentData.ranking,
        yks_score: p.studentData.yks_score,
        yks_type: p.studentData.yks_type,
        wants_tour: p.studentData.wants_tour,
        created_at: p.created_at,
        offline: true
      })))
    } else {
      setOfflineStudents([])
    }
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await studentsAPI.getHistory(200)
      setHistory(data)
    } catch (e) {
      console.error('Failed to load history:', e)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // Initialize network monitor for offline mode
    const initOfflineMode = async () => {
      const { initNetworkMonitor, subscribeToNetworkStatus } = await import('../services/offlineSync')

      // Start monitoring network status
      initNetworkMonitor()

      // Subscribe to network changes to update UI
      const unsubscribe = subscribeToNetworkStatus((online) => {
        if (online) {
          // When coming back online, reload data to show synced students
          updatePendingCount()
        }
      })

      return unsubscribe
    }

    const cleanupPromise = initOfflineMode()

    return () => {
      cleanupPromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe()
      })
    }
  }, [loadData])

  useEffect(() => {
    if (activeTab === 'history' && history.length === 0) {
      loadHistory()
    }
  }, [activeTab, history.length, loadHistory])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ctrl+Enter or Cmd+Enter to submit form
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (activeTab === 'form' && !submitting && formData.first_name && formData.last_name) {
          handleSubmit(e)
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [activeTab, submitting, formData.first_name, formData.last_name])

  const handleCreateMockData = async () => {
    setMockLoading(true)
    try {
      const result = await studentsAPI.createMockData(20)
      showToast(result.message, 'success')
      loadData()
      loadHistory()
    } catch (e) {
      showToast('Mock veri oluşturulamadı', 'error')
    } finally {
      setMockLoading(false)
    }
  }

  const handleLoadTest = async () => {
    if (!confirm('500 öğrenci oluşturulacak (9:00-17:00). Emin misiniz?')) return
    setMockLoading(true)
    try {
      const result = await studentsAPI.createMockData(false, true)
      showToast(result.message, 'success')
      loadData()
      loadHistory()
    } catch (e) {
      showToast('Load test verisi oluşturulamadı', 'error')
    } finally {
      setMockLoading(false)
    }
  }

  const handleDeleteMockData = async () => {
    if (!confirm('Tüm mock veriler silinecek. Emin misiniz?')) return
    setMockLoading(true)
    try {
      const result = await studentsAPI.deleteMockData()
      showToast(result.message, 'success')
      loadData()
      loadHistory()
    } catch (e) {
      showToast('Mock veriler silinemedi', 'error')
    } finally {
      setMockLoading(false)
    }
  }

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const data = await studentsAPI.getDepartments()
        setDepartments(data)
      } catch (e) {
        console.error('Failed to load departments:', e)
      }
    }
    loadDepartments()
  }, [])

  const handleFocus = (field) => {
    setFocusedFields(prev => ({ ...prev, [field]: true }))
    setCurrentFieldIndex(FORM_FIELD_ORDER.indexOf(field))
  }

  const handleBlur = (field) => {
    if (!formData[field]) {
      setFocusedFields(prev => ({ ...prev, [field]: false }))
    }
  }

  // Check for duplicates when email or phone changes
  const checkDuplicates = useCallback(async (email, phone) => {
    if (!email && !phone) {
      setDuplicateWarning(null)
      return
    }

    setCheckingDuplicate(true)
    try {
      const result = await studentsAPI.checkDuplicate(email, phone)
      if (result.has_duplicates) {
        setDuplicateWarning(result)
      } else {
        setDuplicateWarning(null)
      }
    } catch (err) {
      // Silently fail - duplicate check is nice to have, not critical
      console.error('Duplicate check failed:', err)
    } finally {
      setCheckingDuplicate(false)
    }
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setFormData(prev => ({ ...prev, [name]: newValue }))

    // Check duplicates when email or phone changes
    if (name === 'email' || name === 'phone') {
      const email = name === 'email' ? newValue : formData.email
      const phone = name === 'phone' ? newValue : formData.phone
      // Debounce duplicate check
      const timeoutId = setTimeout(() => checkDuplicates(email, phone), 500)
      return () => clearTimeout(timeoutId)
    }
  }

  // Keyboard navigation handler
  const handleKeyDown = (e, fieldName) => {
    const fieldIndex = FORM_FIELD_ORDER.indexOf(fieldName)

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (fieldName === 'wants_tour') {
          // Submit on Enter from last field
          handleSubmit(e)
        } else {
          // Move to next field
          const nextField = FORM_FIELD_ORDER[fieldIndex + 1]
          if (nextField) {
            focusField(nextField)
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        // Reset form
        resetForm()
        break
      case 'ArrowDown':
        e.preventDefault()
        const nextField = FORM_FIELD_ORDER[fieldIndex + 1]
        if (nextField) focusField(nextField)
        break
      case 'ArrowUp':
        e.preventDefault()
        const prevField = FORM_FIELD_ORDER[fieldIndex - 1]
        if (prevField) focusField(prevField)
        break
    }
  }

  const focusField = (fieldName) => {
    const ref = fieldRefs.current[fieldName]
    if (ref) {
      ref.focus()
      setCurrentFieldIndex(FORM_FIELD_ORDER.indexOf(fieldName))
    }
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      high_school: '',
      ranking: '',
      yks_score: '',
      yks_type: '',
      department_id: '',
      wants_tour: false,
    })
    setFocusedFields({})
    setDuplicateWarning(null)
    // Focus first field
    setTimeout(() => focusField('first_name'), 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // If there's a duplicate warning, confirm before proceeding
    if (duplicateWarning && duplicateWarning.has_duplicates) {
      if (!confirm('Bu öğrenci benzer bilgilerle kayıtlı. Yine de kaydetmek istiyor musunuz?')) {
        return
      }
    }

    setSubmitting(true)

    try {
      const payload = {
        ...formData,
        ranking: formData.ranking ? parseInt(formData.ranking) : null,
        yks_score: formData.yks_score ? parseFloat(formData.yks_score) : null,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
      }

      // Import offline sync utilities
      const { safeAPICall } = await import('../services/offlineSync')

      // Use safe API call that handles offline mode
      const result = await safeAPICall(studentsAPI.create, payload)

      // Instant form reset on success
      resetForm()

      if (result.offline) {
        // Stored offline
        showToast('Çevrimdışı modunda kaydedildi. Bağlantı olduğunda gönderilecek.', 'warning')
        await updatePendingCount()
      } else {
        // Successfully sent to server
        // Set new student ID for animation
        if (result.id) {
          setNewStudentId(result.id)
          setTimeout(() => setNewStudentId(null), 2000)
        }

        showToast('Öğrenci kaydedildi!', 'success')
        loadData()
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message
      if (Array.isArray(errorMsg)) {
        showToast(errorMsg.map(e => e.msg).join(', '), 'error')
      } else {
        showToast(errorMsg || 'Kayıt başarısız.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // Register toast callback for OfflineIndicator
  useEffect(() => {
    registerToastCallback(showToast)
  }, [])

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  const getInitials = (first, last) => {
    return (first[0] + last[0]).toUpperCase()
  }

  const isFocused = (field) => focusedFields[field] || formData[field]

  if (loading) {
    return (
      <div className="loading-container min-h-screen">
        <div className="spinner spinner-lg"></div>
        <p className="text-muted">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }} id="main-content">
      <Navbar
        user={user}
        onLogout={onLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showTabs={true}
        tabLabels={{ dashboard: 'Kayıt', students: 'Geçmiş' }}
      />

      {/* Offline Indicator */}
      <OfflineIndicator onShowToast={showToast} />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Form Tab - Enterprise Light Design */}
      {activeTab === 'form' && (
        <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '30px', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
          {/* Left Column - Quick Entry Form */}
          <div>
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              position: 'sticky',
              top: '80px',
              overflow: 'hidden'
            }}>
              {/* Form Header - Minimal Text Only */}
              <div style={{ padding: '20px 24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.2px' }}>Hızlı Kayıt</h2>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '500' }}>Esc</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>•</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '500' }}>Ctrl+Enter</span>
                </div>
              </div>

              {/* Duplicate Warning - Subtle */}
              {duplicateWarning && duplicateWarning.has_duplicates && (
                <div style={{ margin: '0 24px 16px', padding: '12px 16px', background: '#FFF7ED', borderRadius: '12px', fontSize: '12px' }}>
                  <div style={{ fontWeight: '600', color: '#C2410C', marginBottom: '4px', fontSize: '11px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Benzer Kayıt</div>
                  <div style={{ color: '#9A3412', fontSize: '12px' }}>
                    {duplicateWarning.duplicates.map(d => (
                      <div key={d.id} style={{ padding: '2px 0' }}>
                        {d.name} • {d.department || 'Bölüm yok'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Body - Filled Input Style */}
              <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
                {/* Name Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>Ad <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
                    <input
                      ref={el => fieldRefs.current.first_name = el}
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 'first_name')}
                      onFocus={() => handleFocus('first_name')}
                      onBlur={() => handleBlur('first_name')}
                      required
                      autoFocus
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>Soyad <span style={{ color: 'var(--brand-primary)' }}>*</span></label>
                    <input
                      ref={el => fieldRefs.current.last_name = el}
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 'last_name')}
                      onFocus={() => handleFocus('last_name')}
                      onBlur={() => handleBlur('last_name')}
                      required
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>E-posta</label>
                  <input
                    ref={el => fieldRefs.current.email = el}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, 'email')}
                    onFocus={() => handleFocus('email')}
                    onBlur={() => handleBlur('email')}
                    placeholder=""
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-input)',
                      background: duplicateWarning?.has_duplicates ? '#FFF7ED' : 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                </div>

                {/* Phone */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>Telefon</label>
                  <input
                    ref={el => fieldRefs.current.phone = el}
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, 'phone')}
                    onFocus={() => handleFocus('phone')}
                    onBlur={() => handleBlur('phone')}
                    placeholder=""
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-input)',
                      background: duplicateWarning?.has_duplicates ? '#FFF7ED' : 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                </div>

                {/* High School */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>Lise</label>
                  <input
                    ref={el => fieldRefs.current.high_school = el}
                    type="text"
                    name="high_school"
                    value={formData.high_school}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, 'high_school')}
                    onFocus={() => handleFocus('high_school')}
                    onBlur={() => handleBlur('high_school')}
                    placeholder=""
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-input)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                </div>

                {/* Academic Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>Sıralama</label>
                    <input
                      ref={el => fieldRefs.current.ranking = el}
                      type="number"
                      name="ranking"
                      value={formData.ranking}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 'ranking')}
                      onFocus={() => handleFocus('ranking')}
                      onBlur={() => handleBlur('ranking')}
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>Puan</label>
                    <input
                      ref={el => fieldRefs.current.yks_score = el}
                      type="number"
                      name="yks_score"
                      value={formData.yks_score}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 'yks_score')}
                      onFocus={() => handleFocus('yks_score')}
                      onBlur={() => handleBlur('yks_score')}
                      step="0.01"
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>YKS Türü</label>
                    <select
                      ref={el => fieldRefs.current.yks_type = el}
                      name="yks_type"
                      value={formData.yks_type}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 'yks_type')}
                      onFocus={() => handleFocus('yks_type')}
                      onBlur={() => handleBlur('yks_type')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230F172A' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 14px center'
                      }}
                    >
                      <option value="">Seçiniz</option>
                      <option value="SAYISAL">Sayısal</option>
                      <option value="SOZEL">Sözel</option>
                      <option value="EA">EA</option>
                      <option value="DIL">Dil</option>
                    </select>
                  </div>
                </div>

                {/* Department */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.2px' }}>Bölüm</label>
                  <select
                    ref={el => fieldRefs.current.department_id = el}
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, 'department_id')}
                    onFocus={() => handleFocus('department_id')}
                    onBlur={() => handleBlur('department_id')}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-input)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230F172A' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 14px center'
                    }}
                  >
                    <option value="">Bölüm Seçiniz</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Campus Tour - Admin Style Segmented Control */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', letterSpacing: '0.2px' }}>Kampüs Turu</label>
                  <div style={{ display: 'inline-flex', background: 'var(--hover-bg)', borderRadius: '8px', padding: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, wants_tour: true }))}
                      style={{
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: '500',
                        border: 'none',
                        borderRadius: '6px',
                        background: formData.wants_tour ? '#0F172A' : 'transparent',
                        color: formData.wants_tour ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Evet
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, wants_tour: false }))}
                      style={{
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: '500',
                        border: 'none',
                        borderRadius: '6px',
                        background: !formData.wants_tour ? '#0F172A' : 'transparent',
                        color: !formData.wants_tour ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Hayır
                    </button>
                  </div>
                </div>

                {/* Submit Button - Navy Gradient */}
                <button
                  type="submit"
                  disabled={submitting || !formData.first_name || !formData.last_name}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: submitting || !formData.first_name || !formData.last_name ? '#CBD5E1' : 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: submitting || !formData.first_name || !formData.last_name ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.2)',
                    cursor: submitting || !formData.first_name || !formData.last_name ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column - Recent Registrations List */}
          <div>
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header - Text Only */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Son Kayıtlar</span>
              </div>

              {/* Scrollable List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: '#E2E8F0 transparent'
              }}>
                {students.length === 0 && offlineStudents.length === 0 ? (
                  <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, fontWeight: '500' }}>Henüz kayıt yok</p>
                    <p style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '4px' }}>Yeni kayıtlar burada görünecek</p>
                  </div>
                ) : (
                  <>
                    {/* Offline students section */}
                    {offlineStudents.length > 0 && (
                      <div style={{ padding: '16px 24px', background: '#FFF7ED' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#C2410C', marginBottom: '12px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                          Bekleyen Kayıtlar
                        </div>
                        {offlineStudents.map((student) => (
                          <div
                            key={student.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 0',
                              borderBottom: '1px solid #FED7AA'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: '#FED7AA',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#9A3412'
                              }}>
                                {getInitials(student.first_name, student.last_name)}
                              </div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                  {student.first_name} {student.last_name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#C2410C' }}>
                                  Beklemede
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Online students - Brand Color Avatars */}
                    {students.map((student, index) => {
                      return (
                        <div
                          key={student.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 24px',
                            borderBottom: '1px solid #F1F5F9',
                            background: newStudentId === student.id ? '#F0F9FF' : 'transparent',
                            transition: 'background 0.2s ease'
                          }}
                        >
                          {/* Avatar + Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: 'var(--brand-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: 'white'
                            }}>
                              {getInitials(student.first_name, student.last_name)}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>
                                {student.first_name} {student.last_name}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {student.department_name || 'Bölüm seçilmedi'}
                              </div>
                            </div>
                          </div>

                          {/* Time + Tour Indicator */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              fontSize: '13px',
                              color: 'var(--text-secondary)',
                              fontVariantNumeric: 'tabular-nums'
                            }}>
                              {formatDateTime(student.created_at)}
                            </span>
                            {student.wants_tour && (
                              <span style={{
                                fontSize: '10px',
                                padding: '4px 10px',
                                background: '#ECFDF5',
                                color: '#059669',
                                borderRadius: '12px',
                                fontWeight: '600',
                                letterSpacing: '0.3px'
                              }}>
                                Tur
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Tab - Enterprise Light Design */}
      {activeTab === 'history' && (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', minHeight: 'calc(100vh - 100px)' }}>
          {/* Page Header */}
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Kayıt Geçmişi</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: '500' }}>
              Son 30 gün • Toplam {history.reduce((sum, d) => sum + (d.students?.length || 0), 0)} kayıt
            </p>
          </div>

          {historyLoading ? (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-color)',
              padding: '80px 40px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #E2E8F0',
                borderTopColor: 'var(--brand-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px'
              }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Yükleniyor...</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-color)',
              padding: '80px 40px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0, fontWeight: '500' }}>Henüz kayıt geçmişi yok</p>
            </div>
          ) : (
            <>
              {/* Daily Cards Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {history.map((dayGroup) => {
                  const today = new Date().toDateString()
                  const yesterday = new Date(Date.now() - 86400000).toDateString()
                  const groupDate = new Date(dayGroup.date.split('.').reverse().join('-'))
                  const isToday = groupDate.toDateString() === today
                  const isYesterday = groupDate.toDateString() === yesterday
                  const students = dayGroup.students || []
                  const visibleStudents = students.slice(0, 5)
                  const hiddenCount = students.length - 5
                  const expanded = expandedCards[dayGroup.date] || false
                  const setExpanded = (val) => setExpandedCards(prev => ({ ...prev, [dayGroup.date]: val }))
                  const displayStudents = expanded ? students : visibleStudents

                  // YKS Badge Colors - Admin Design System
                  const yksColors = {
                    'SAYISAL': { bg: '#F1F5F9', text: '#0F172A', short: 'SAY' },
                    'SOZEL': { bg: '#FEF3C7', text: '#92400E', short: 'SÖZ' },
                    'EA': { bg: '#E0E7FF', text: '#3730A3', short: 'EA' },
                    'DIL': { bg: '#D1FAE5', text: '#065F46', short: 'DİL' }
                  }

                  return (
                    <div
                      key={dayGroup.date}
                      style={{
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-card)',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                      }}
                    >
                      {/* Group Header */}
                      <div style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid #F1F5F9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.1px'
                        }}>
                          {dayGroup.date}
                          {isToday && <span style={{ color: 'var(--brand-primary)', marginLeft: '6px' }}>Bugün</span>}
                          {isYesterday && <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>Dün</span>}
                        </span>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: 'var(--text-secondary)'
                        }}>
                          {students.length} kayıt
                        </span>
                      </div>

                      {/* Column Headers */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1.8fr 1.4fr 1.4fr 1fr 0.9fr 0.7fr 60px',
                        gap: '16px',
                        padding: '10px 24px',
                        background: '#FAFBFC',
                        borderBottom: '1px solid #F1F5F9'
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Öğrenci</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bölüm</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>İletişim</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sıralama</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>YKS</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Puan</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Saat</span>
                      </div>

                      {/* Student Rows */}
                      {displayStudents.map((student, idx) => {
                        const yksBadge = yksColors[student.yks_type] || { bg: '#F1F5F9', text: '#94A3B8', short: '-' }

                        return (
                          <div
                            key={student.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.8fr 1.4fr 1.4fr 1fr 0.9fr 0.7fr 60px',
                              gap: '16px',
                              padding: '14px 24px',
                              borderBottom: idx < displayStudents.length - 1 ? '1px solid #F8FAFC' : 'none',
                              alignItems: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#FAFBFC'
                              e.currentTarget.style.paddingLeft = '28px'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.paddingLeft = '24px'
                            }}
                          >
                            {/* Student Name */}
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px', letterSpacing: '-0.1px' }}>
                              {student.first_name} {student.last_name}
                            </div>

                            {/* Department */}
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {student.department_name || '-'}
                            </div>

                            {/* Contact */}
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {student.email || student.phone || '-'}
                            </div>

                            {/* Ranking */}
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                              {student.ranking ? `#${student.ranking.toLocaleString('tr-TR')}` : '-'}
                            </div>

                            {/* YKS Badge */}
                            <div>
                              {student.yks_type ? (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '4px 10px',
                                  background: yksBadge.bg,
                                  color: yksBadge.text,
                                  borderRadius: '8px',
                                  fontWeight: '600',
                                  letterSpacing: '0.3px'
                                }}>
                                  {yksBadge.short}
                                </span>
                              ) : (
                                <span style={{ color: '#CBD5E1', fontSize: '12px' }}>-</span>
                              )}
                            </div>

                            {/* Score */}
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                              {student.yks_score || '-'}
                            </div>

                            {/* Time */}
                            <div style={{
                              fontSize: '13px',
                              color: 'var(--text-secondary)',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums'
                            }}>
                              {new Date(student.created_at).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        )
                      })}

                      {/* Expand Button */}
                      {hiddenCount > 0 && !expanded && (
                        <button
                          onClick={() => setExpanded(true)}
                          style={{
                            width: '100%',
                            padding: '14px 24px',
                            background: 'transparent',
                            border: 'none',
                            borderTop: '1px solid #F1F5F9',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FAFBFC'
                            e.currentTarget.style.color = 'var(--brand-primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: '2px' }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          Diğer {hiddenCount} kaydı göster
                        </button>
                      )}

                      {/* Collapse Button */}
                      {expanded && hiddenCount > 0 && (
                        <button
                          onClick={() => setExpanded(false)}
                          style={{
                            width: '100%',
                            padding: '12px 24px',
                            background: 'transparent',
                            border: 'none',
                            borderTop: '1px solid #F1F5F9',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FAFBFC'
                            e.currentTarget.style.color = 'var(--brand-primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: '-2px' }}>
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                          Daralt
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default TeacherDashboard
