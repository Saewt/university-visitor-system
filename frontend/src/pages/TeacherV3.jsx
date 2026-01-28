import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, studentsAPI, statsAPI } from '../services/api'
import Navbar from '../components/Navbar'
import OfflineIndicator from '../components/OfflineIndicator'
import { getPendingCount } from '../services/offlineStorage'

const FORM_FIELD_ORDER = ['first_name', 'last_name', 'email', 'phone', 'high_school', 'ranking', 'yks_score', 'yks_type', 'department_id', 'wants_tour']

function TeacherV3({ user: initialUser, onLogout }) {
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
  const [departments, setDepartments] = useState([])
  const navigate = useNavigate()
  const fieldRefs = useRef({})

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', high_school: '',
    ranking: '', yks_score: '', yks_type: '', department_id: '', wants_tour: false,
  })

  const loadData = useCallback(async () => {
    try {
      const [studentsResponse, summary] = await Promise.all([studentsAPI.getAll({ limit: 50 }), statsAPI.getSummary()])
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
        email: p.studentData.email, phone: p.studentData.phone, department_id: p.studentData.department_id,
        department_name: departments.find(d => d.id === p.studentData.department_id)?.name || '-',
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
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const resetForm = () => { setFormData({ first_name: '', last_name: '', email: '', phone: '', high_school: '', ranking: '', yks_score: '', yks_type: '', department_id: '', wants_tour: false }) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = { ...formData, ranking: formData.ranking ? parseInt(formData.ranking) : null, yks_score: formData.yks_score ? parseFloat(formData.yks_score) : null, department_id: formData.department_id ? parseInt(formData.department_id) : null }
      const { safeAPICall } = await import('../services/offlineSync')
      const result = await safeAPICall(studentsAPI.create, payload)
      resetForm()
      if (result.offline) { showToast('Çevrimdışı modda kaydedildi', 'warning'); await updatePendingCount() }
      else { if (result.id) { setNewStudentId(result.id); setTimeout(() => setNewStudentId(null), 2000) } showToast('Öğrenci kaydedildi!', 'success'); loadData() }
    } catch (err) { showToast('Kayıt başarısız', 'error') }
    finally { setSubmitting(false) }
  }

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000) }

  const formatDateTime = (dateStr) => new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  if (loading) return <div className="loading-container min-h-screen"><div className="spinner spinner-lg"></div><p className="text-muted">Yükleniyor...</p></div>

  const yksColors = { 'SAYISAL': { bg: '#1E40AF20', text: '#60A5FA', short: 'SAY' }, 'SOZEL': { bg: '#B4530920', text: '#FBBF24', short: 'SÖZ' }, 'EA': { bg: '#7C3AED20', text: '#A78BFA', short: 'EA' }, 'DIL': { bg: '#05966920', text: '#34D399', short: 'DİL' } }

  // V3: Dark-inspired, compact, efficient design
  return (
    <div style={{ minHeight: '100vh', background: '#0F172A' }}>
      <Navbar user={user} onLogout={onLogout} activeTab={activeTab} onTabChange={setActiveTab} showTabs={true} tabLabels={{ dashboard: 'Kayıt', students: 'Geçmiş' }} />
      <OfflineIndicator />

      {toast && (
        <div className="fade-in-down" style={{ position: 'fixed', top: '72px', right: '20px', zIndex: 1000, padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', background: toast.type === 'success' ? '#22C55E' : toast.type === 'warning' ? '#F59E0B' : '#EF4444', color: 'white', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {toast.message}
        </div>
      )}

      {activeTab === 'form' && (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>
          {/* Compact Form */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div style={{ background: '#1E293B', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
              <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #334155' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC', margin: 0 }}>Öğrenci Kaydı</h2>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Ad *</label>
                    <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required autoFocus style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'} onBlur={(e) => e.currentTarget.style.borderColor = '#334155'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Soyad *</label>
                    <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'} onBlur={(e) => e.currentTarget.style.borderColor = '#334155'} />
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>E-posta</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'} onBlur={(e) => e.currentTarget.style.borderColor = '#334155'} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Telefon</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'} onBlur={(e) => e.currentTarget.style.borderColor = '#334155'} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Lise</label>
                  <input type="text" name="high_school" value={formData.high_school} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none' }} onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'} onBlur={(e) => e.currentTarget.style.borderColor = '#334155'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Sıralama</label>
                    <input type="number" name="ranking" value={formData.ranking} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Puan</label>
                    <input type="number" name="yks_score" value={formData.yks_score} onChange={handleChange} step="0.01" style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>YKS</label>
                    <select name="yks_type" value={formData.yks_type} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none', cursor: 'pointer' }}>
                      <option value="">Seç</option>
                      <option value="SAYISAL">Sayısal</option>
                      <option value="SOZEL">Sözel</option>
                      <option value="EA">EA</option>
                      <option value="DIL">Dil</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Bölüm</label>
                  <select name="department_id" value={formData.department_id} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #334155', borderRadius: '8px', background: '#0F172A', color: '#F8FAFC', outline: 'none', cursor: 'pointer' }}>
                    <option value="">Bölüm Seçiniz</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, wants_tour: !prev.wants_tour }))} style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: '600', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', background: formData.wants_tour ? '#3B82F6' : '#1E293B', color: formData.wants_tour ? 'white' : '#64748B' }}>Tur: {formData.wants_tour ? 'Evet' : 'Hayır'}</button>
                  </div>
                </div>

                <button type="submit" disabled={submitting || !formData.first_name || !formData.last_name} style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '700', background: (!formData.first_name || !formData.last_name) ? '#334155' : '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: (!formData.first_name || !formData.last_name) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                  {submitting ? '...' : 'Kaydet'}
                </button>
              </form>
            </div>

            {/* Today Counter */}
            <div style={{ marginTop: '12px', background: '#1E293B', borderRadius: '12px', padding: '16px', border: '1px solid #334155', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' }}>BUGÜN</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#3B82F6', lineHeight: '1' }}>{todayCount}</div>
            </div>
          </div>

          {/* Compact List */}
          <div>
            <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>Son Kayıtlar</span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>{students.length} öğrenci</span>
              </div>

              <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                {students.length === 0 && offlineStudents.length === 0 ? (
                  <div style={{ padding: '50px 30px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#475569' }}>Kayıt yok</p>
                  </div>
                ) : (
                  <>
                    {offlineStudents.length > 0 && (
                      <div style={{ padding: '12px 18px', background: '#78350F20', borderBottom: '1px solid #334155' }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#F59E0B', marginBottom: '8px', textTransform: 'uppercase' }}>Bekleyen</div>
                        {offlineStudents.map((student) => (
                          <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #33415533' }}>
                            <span style={{ fontSize: '13px', color: '#F8FAFC' }}>{student.first_name} {student.last_name}</span>
                            <span style={{ fontSize: '11px', color: '#F59E0B' }}>Beklemede</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {students.map((student) => (
                      <div key={student.id} style={{ padding: '12px 18px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: newStudentId === student.id ? '#1E40AF30' : 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white' }}>{student.first_name[0]}{student.last_name[0]}</div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#F8FAFC' }}>{student.first_name} {student.last_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{student.department_name || '-'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>{formatDateTime(student.created_at)}</span>
                          {student.wants_tour && <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', background: '#22C55E20', color: '#22C55E', borderRadius: '6px' }}>T</span>}
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
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC', marginBottom: '6px' }}>Kayıt Geçmişi</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>Toplam {history.reduce((sum, d) => sum + (d.students?.length || 0), 0)} kayıt</p>

          {historyLoading ? <div style={{ padding: '60px 40px', textAlign: 'center', background: '#1E293B', borderRadius: '12px' }}><div className="spinner spinner-lg"></div></div> : history.length === 0 ? <div style={{ padding: '60px 40px', textAlign: 'center', background: '#1E293B', borderRadius: '12px' }}><p style={{ fontSize: '14px', color: '#475569' }}>Kayıt geçmişi yok</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map((dayGroup) => {
                const today = new Date().toDateString()
                const groupDate = new Date(dayGroup.date.split('.').reverse().join('-'))
                const isToday = groupDate.toDateString() === today
                const students = dayGroup.students || []
                const visibleStudents = students.slice(0, 5)
                const hiddenCount = students.length - 5
                const expanded = expandedCards[dayGroup.date] || false
                const displayStudents = expanded ? students : visibleStudents

                return (
                  <div key={dayGroup.date} style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>{dayGroup.date} {isToday && <span style={{ color: '#3B82F6', marginLeft: '6px' }}>Bugün</span>}</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#3B82F6' }}>{students.length}</span>
                    </div>

                    {displayStudents.map((student) => {
                      const yksBadge = yksColors[student.yks_type] || { bg: '#334155', text: '#64748B', short: '-' }
                      return (
                        <div key={student.id} style={{ padding: '12px 16px', borderBottom: '1px solid #1E293B', display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.7fr 0.7fr 50px', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
                          <span style={{ color: '#F8FAFC', fontWeight: '500' }}>{student.first_name} {student.last_name}</span>
                          <span style={{ color: '#94A3B8' }}>{student.department_name || '-'}</span>
                          <span style={{ color: '#64748B', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.email || student.phone || '-'}</span>
                          <span style={{ color: '#94A3B8' }}>{student.ranking ? `#${student.ranking}` : '-'}</span>
                          <span>{student.yks_type ? <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', background: yksBadge.bg, color: yksBadge.text, borderRadius: '6px' }}>{yksBadge.short}</span> : <span style={{ color: '#334155' }}>-</span>}</span>
                          <span style={{ color: '#64748B', textAlign: 'right', fontSize: '11px' }}>{new Date(student.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )
                    })}

                    {hiddenCount > 0 && !expanded && (
                      <button onClick={() => setExpandedCards(prev => ({ ...prev, [dayGroup.date]: true }))} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', borderTop: '1px solid #334155', color: '#64748B', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ {hiddenCount} daha</button>
                    )}
                    {expanded && hiddenCount > 0 && (
                      <button onClick={() => setExpandedCards(prev => ({ ...prev, [dayGroup.date]: false }))} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', borderTop: '1px solid #334155', color: '#64748B', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Daralt</button>
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

export default TeacherV3
