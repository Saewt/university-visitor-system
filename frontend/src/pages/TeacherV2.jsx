import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, studentsAPI, statsAPI } from '../services/api'
import Navbar from '../components/Navbar'
import OfflineIndicator from '../components/OfflineIndicator'
import { getPendingCount } from '../services/offlineStorage'

const FORM_FIELD_ORDER = ['first_name', 'last_name', 'email', 'phone', 'high_school', 'ranking', 'yks_score', 'yks_type', 'department_id', 'wants_tour']

function TeacherV2({ user: initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser)
  const [students, setStudents] = useState([])
  const [offlineStudents, setOfflineStudents] = useState([])
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [newStudentId, setNewStudentId] = useState(null)
  const [activeTab, setActiveTab] = useState('form')
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [expandedCards, setExpandedCards] = useState({})
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [departments, setDepartments] = useState([])
  const navigate = useNavigate()
  const formRef = useRef(null)
  const fieldRefs = useRef({})

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', high_school: '',
    ranking: '', yks_score: '', yks_type: '', department_id: '', wants_tour: false,
  })
  const [focusedFields, setFocusedFields] = useState({})

  const loadData = useCallback(async () => {
    try {
      const [studentsResponse, summary] = await Promise.all([
        studentsAPI.getAll({ limit: 50 }),
        statsAPI.getSummary()
      ])
      const studentsData = studentsResponse.data || studentsResponse
      setStudents(Array.isArray(studentsData) ? studentsData : [])
      setTodayCount(summary.today_count)
      updatePendingCount()
    } catch (e) { console.error('Failed to load data:', e) } finally { setLoading(false) }
  }, [])

  const updatePendingCount = async () => {
    const count = await getPendingCount()
    setPendingCount(count)
    if (count > 0) {
      const { getPendingStudents } = await import('../services/offlineStorage')
      const pending = await getPendingStudents()
      setOfflineStudents(pending.map(p => ({
        id: `offline-${p.id}`, first_name: p.studentData.first_name, last_name: p.studentData.last_name,
        email: p.studentData.email, phone: p.studentData.phone, high_school: p.studentData.high_school,
        department_id: p.studentData.department_id, department_name: departments.find(d => d.id === p.studentData.department_id)?.name || '-',
        ranking: p.studentData.ranking, yks_score: p.studentData.yks_score, yks_type: p.studentData.yks_type,
        wants_tour: p.studentData.wants_tour, created_at: p.created_at, offline: true
      })))
    } else { setOfflineStudents([]) }
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try { setHistory(await studentsAPI.getHistory(200)) }
    catch (e) { console.error('Failed to load history:', e) }
    finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => {
    loadData()
    const initOfflineMode = async () => {
      const { initNetworkMonitor, subscribeToNetworkStatus } = await import('../services/offlineSync')
      initNetworkMonitor()
      const unsubscribe = subscribeToNetworkStatus((online) => { if (online) updatePendingCount() })
      return unsubscribe
    }
    const cleanupPromise = initOfflineMode()
    return () => { cleanupPromise.then(unsubscribe => { if (unsubscribe) unsubscribe() }) }
  }, [loadData])

  useEffect(() => { if (activeTab === 'history' && history.length === 0) loadHistory() }, [activeTab, history.length, loadHistory])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setFormData(prev => ({ ...prev, [name]: newValue }))
  }

  const resetForm = () => {
    setFormData({ first_name: '', last_name: '', email: '', phone: '', high_school: '', ranking: '', yks_score: '', yks_type: '', department_id: '', wants_tour: false })
    setFocusedFields({})
    setDuplicateWarning(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (duplicateWarning?.has_duplicates && !confirm('Bu öğrenci benzer bilgilerle kayıtlı. Devam etmek istiyor musunuz?')) return
    setSubmitting(true)
    try {
      const payload = { ...formData, ranking: formData.ranking ? parseInt(formData.ranking) : null, yks_score: formData.yks_score ? parseFloat(formData.yks_score) : null, department_id: formData.department_id ? parseInt(formData.department_id) : null }
      const { safeAPICall } = await import('../services/offlineSync')
      const result = await safeAPICall(studentsAPI.create, payload)
      resetForm()
      if (result.offline) { showToast('Çevrimdışı modunda kaydedildi', 'warning'); await updatePendingCount() }
      else { if (result.id) { setNewStudentId(result.id); setTimeout(() => setNewStudentId(null), 2000) } showToast('Öğrenci kaydedildi!', 'success'); loadData() }
    } catch (err) { showToast(err.response?.data?.detail || 'Kayıt başarısız.', 'error') }
    finally { setSubmitting(false) }
  }

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000) }

  const formatDateTime = (dateStr) => new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const getInitials = (first, last) => (first[0] + last[0]).toUpperCase()

  if (loading) return <div className="loading-container min-h-screen"><div className="spinner spinner-lg"></div><p className="text-muted">Yükleniyor...</p></div>

  const yksColors = { 'SAYISAL': { bg: '#DBEAFE', text: '#1D4ED8', short: 'SAY' }, 'SOZEL': { bg: '#FEF3C7', text: '#D97706', short: 'SÖZ' }, 'EA': { bg: '#EDE9FE', text: '#7C3AED', short: 'EA' }, 'DIL': { bg: '#D1FAE5', text: '#059669', short: 'DİL' } }

  // V2: Cleaner, card-based with rounded corners and softer colors
  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFC' }}>
      <Navbar user={user} onLogout={onLogout} activeTab={activeTab} onTabChange={setActiveTab} showTabs={true} tabLabels={{ dashboard: 'Kayıt', students: 'Geçmiş' }} />
      <OfflineIndicator />

      {toast && (
        <div className="fade-in-down" style={{ position: 'fixed', top: '72px', right: '20px', zIndex: 1000, padding: '14px 20px', borderRadius: '14px', fontSize: '14px', fontWeight: '600', background: toast.type === 'success' ? '#10B981' : toast.type === 'warning' ? '#F59E0B' : '#EF4444', color: 'white', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          {toast.message}
        </div>
      )}

      {activeTab === 'form' && (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Form Card */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>Öğrenci Kaydı</h2>
                <p style={{ fontSize: '13px', color: '#64748B' }}>Yeni öğrenci bilgilerini girin</p>
              </div>

              {duplicateWarning?.has_duplicates && (
                <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#B45309', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Benzer Kayıt</div>
                  {duplicateWarning.duplicates.map(d => <div key={d.id} style={{ fontSize: '13px', color: '#92400E' }}>{d.name} • {d.department || 'Bölüm yok'}</div>)}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Ad *</label>
                    <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required autoFocus style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', transition: 'all 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'} onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Soyad *</label>
                    <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', transition: 'all 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'} onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'} />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>E-posta</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', transition: 'all 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'} onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Telefon</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', transition: 'all 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'} onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Lise</label>
                  <input type="text" name="high_school" value={formData.high_school} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', transition: 'all 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'} onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Sıralama</label>
                    <input type="number" name="ranking" value={formData.ranking} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', transition: 'all 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'} onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Puan</label>
                    <input type="number" name="yks_score" value={formData.yks_score} onChange={handleChange} step="0.01" style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', transition: 'all 0.2s' }} onFocus={(e) => e.currentTarget.style.borderColor = '#6366F1'} onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>YKS</label>
                    <select name="yks_type" value={formData.yks_type} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236366F1' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}>
                      <option value="">Seçiniz</option>
                      <option value="SAYISAL">Sayısal</option>
                      <option value="SOZEL">Sözel</option>
                      <option value="EA">EA</option>
                      <option value="DIL">Dil</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Bölüm</label>
                  <select name="department_id" value={formData.department_id} onChange={handleChange} style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236366F1' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}>
                    <option value="">Bölüm Seçiniz</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '8px' }}>Kampüs Turu</label>
                  <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px' }}>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, wants_tour: true }))} style={{ padding: '10px 24px', fontSize: '13px', fontWeight: '600', border: 'none', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', background: formData.wants_tour ? '#6366F1' : 'transparent', color: formData.wants_tour ? 'white' : '#64748B' }}>Evet</button>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, wants_tour: false }))} style={{ padding: '10px 24px', fontSize: '13px', fontWeight: '600', border: 'none', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', background: !formData.wants_tour ? '#6366F1' : 'transparent', color: !formData.wants_tour ? 'white' : '#64748B' }}>Hayır</button>
                  </div>
                </div>

                <button type="submit" disabled={submitting || !formData.first_name || !formData.last_name} style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: '700', background: (!formData.first_name || !formData.last_name) ? '#CBD5E1' : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', color: 'white', border: 'none', borderRadius: '12px', cursor: (!formData.first_name || !formData.last_name) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}>
                  {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </form>
            </div>

            {/* Today Counter */}
            <div style={{ marginTop: '16px', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', borderRadius: '16px', padding: '20px', textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', opacity: 0.9, marginBottom: '4px' }}>Bugünün Kayıtları</div>
              <div style={{ fontSize: '42px', fontWeight: '800', lineHeight: '1' }}>{todayCount}</div>
            </div>
          </div>

          {/* Recent List */}
          <div>
            <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#1E293B' }}>Son Kayıtlar</span>
                <span style={{ fontSize: '13px', color: '#64748B' }}>{students.length} öğrenci</span>
              </div>

              <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                {students.length === 0 && offlineStudents.length === 0 ? (
                  <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='#CBD5E1' strokeWidth='1.5'><path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' /><circle cx='9' cy='7' r='4' /><path d='M23 21v-2a4 4 0 00-3-3.87' /><path d='M16 3.13a4 4 0 010 7.75' /></svg>
                    </div>
                    <p style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '500' }}>Henüz kayıt yok</p>
                  </div>
                ) : (
                  <>
                    {offlineStudents.length > 0 && (
                      <div style={{ padding: '16px 24px', background: '#FEF3C7' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bekleyen Kayıtlar</div>
                        {offlineStudents.map((student) => (
                          <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #FDE68A' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#92400E' }}>{getInitials(student.first_name, student.last_name)}</div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#78350F' }}>{student.first_name} {student.last_name}</div>
                                <div style={{ fontSize: '12px', color: '#B45309' }}>Beklemede</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {students.map((student) => (
                      <div key={student.id} style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: newStudentId === student.id ? '#F0F9FF' : 'transparent', transition: 'background 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', color: 'white' }}>{getInitials(student.first_name, student.last_name)}</div>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>{student.first_name} {student.last_name}</div>
                            <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>{student.department_name || 'Bölüm seçilmedi'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '13px', color: '#64748B' }}>{formatDateTime(student.created_at)}</span>
                          {student.wants_tour && <span style={{ fontSize: '11px', fontWeight: '700', padding: '5px 10px', background: '#D1FAE5', color: '#059669', borderRadius: '10px' }}>Tur</span>}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1E293B', marginBottom: '8px' }}>Kayıt Geçmişi</h1>
          <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>Son 30 gün • Toplam {history.reduce((sum, d) => sum + (d.students?.length || 0), 0)} kayıt</p>

          {historyLoading ? <div style={{ padding: '80px 40px', textAlign: 'center', background: 'white', borderRadius: '20px' }}><div className="spinner spinner-lg"></div></div> : history.length === 0 ? <div style={{ padding: '80px 40px', textAlign: 'center', background: 'white', borderRadius: '20px' }}><p style={{ fontSize: '15px', color: '#94A3B8' }}>Kayıt geçmişi yok</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {history.map((dayGroup) => {
                const today = new Date().toDateString()
                const yesterday = new Date(Date.now() - 86400000).toDateString()
                const groupDate = new Date(dayGroup.date.split('.').reverse().join('-'))
                const isToday = groupDate.toDateString() === today
                const isYesterday = groupDate.toDateString() === yesterday
                const students = dayGroup.students || []
                const visibleStudents = students.slice(0, 4)
                const hiddenCount = students.length - 4
                const expanded = expandedCards[dayGroup.date] || false
                const displayStudents = expanded ? students : visibleStudents

                return (
                  <div key={dayGroup.date} style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>{dayGroup.date} {isToday && <span style={{ color: '#6366F1', marginLeft: '6px' }}>Bugün</span>} {isYesterday && <span style={{ color: '#94A3B8', marginLeft: '6px' }}>Dün</span>}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#6366F1' }}>{students.length} kayıt</span>
                    </div>

                    <div>
                      {displayStudents.map((student) => {
                        const yksBadge = yksColors[student.yks_type] || { bg: '#F1F5F9', text: '#64748B', short: '-' }
                        return (
                          <div key={student.id} style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.8fr 0.8fr 60px', gap: '16px', alignItems: 'center' }}>
                            <div style={{ fontWeight: '600', color: '#1E293B', fontSize: '14px' }}>{student.first_name} {student.last_name}</div>
                            <div style={{ fontSize: '13px', color: '#64748B' }}>{student.department_name || '-'}</div>
                            <div style={{ fontSize: '12px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.email || student.phone || '-'}</div>
                            <div style={{ fontSize: '13px', color: '#64748B' }}>{student.ranking ? `#${student.ranking.toLocaleString('tr-TR')}` : '-'}</div>
                            <div>{student.yks_type ? <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', background: yksBadge.bg, color: yksBadge.text, borderRadius: '8px' }}>{yksBadge.short}</span> : <span style={{ color: '#CBD5E1' }}>-</span>}</div>
                            <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'right' }}>{new Date(student.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        )
                      })}
                    </div>

                    {hiddenCount > 0 && !expanded && (
                      <button onClick={() => setExpandedCards(prev => ({ ...prev, [dayGroup.date]: true }))} style={{ width: '100%', padding: '12px', background: 'transparent', border: 'none', borderTop: '1px solid #F1F5F9', color: '#6366F1', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Diğer {hiddenCount} kaydı göster ↓</button>
                    )}
                    {expanded && hiddenCount > 0 && (
                      <button onClick={() => setExpandedCards(prev => ({ ...prev, [dayGroup.date]: false }))} style={{ width: '100%', padding: '12px', background: 'transparent', border: 'none', borderTop: '1px solid #F1F5F9', color: '#6366F1', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Daralt ↑</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TeacherV2
