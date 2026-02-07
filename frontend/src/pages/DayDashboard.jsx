import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authAPI, studentsAPI, statsAPI, exportAPI } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import Navbar from '../components/Navbar'

const COLORS = ['#2563EB', '#059669', '#F59E0B', '#0284C7', '#DC2626', '#9B59B6', '#E67E22', '#16A085']

function DayDashboard({ user, onLogout }) {
  const { date } = useParams()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, studentsData] = await Promise.all([
        statsAPI.getDayStats(date),
        studentsAPI.getHistoryByDate(date, 500)
      ])
      setStats(statsData)
      setStudents(studentsData)
    } catch (e) {
      console.error('Failed to load day data:', e)
      showToast('Veriler yüklenemedi', 'error')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleLogout = async () => {
    await authAPI.logout()
    onLogout()
    navigate('/login')
  }

  const handleExport = async () => {
    try {
      // Convert DD.MM.YYYY to YYYY-MM-DD for API
      const dateParts = date.split('.')
      const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
      const response = await exportAPI.exportDaily(isoDate)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ogrenci_raporu_${isoDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      showToast('Excel raporu indirildi', 'success')
    } catch (e) {
      showToast('Dışa aktarım başarısız', 'error')
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const typeMapping = { 'SAYISAL': 'Sayısal', 'SOZEL': 'Sözel', 'EA': 'EA', 'DIL': 'Dil' }

  if (loading) {
    return (
      <div className="loading-container min-h-screen">
        <div className="spinner spinner-lg"></div>
        <p className="text-muted">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)' }} id="main-content">
      <Navbar user={user} onLogout={handleLogout} activeTab="history" onTabChange={(tab) => navigate('/admin')} showTabs={true} showHistoryTab={true} />

      {/* Toast */}
      {toast && (
        <div className="fade-in-down" style={{
          position: 'fixed',
          top: '72px',
          right: '20px',
          zIndex: 1000,
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          fontWeight: '500',
          background: toast.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)',
          color: 'white',
          boxShadow: 'var(--shadow-md)'
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/admin')}
              style={{
                background: 'var(--card-header-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--card-header-bg)'}
            >
              ← Geri
            </button>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {date} Günlük Dashboard
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Wayback Machine - Tarihi Kayıtlar
              </p>
            </div>
          </div>
          <button onClick={handleExport} className="btn btn-success" style={{ gap: '6px', padding: '10px 16px', fontSize: '13px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Excel Dışa Aktar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid" style={{ gap: '16px', marginBottom: '20px' }}>
          <StatCard label="TOPLAM ÖĞRENCİ" value={stats?.summary?.total_students || 0} color="#2563EB" />
          <StatCard label="TUR İSTEĞİ" value={stats?.summary?.tour_requests || 0} color="#F59E0B" />
          <StatCard label="BÖLÜM SAYISI" value={stats?.summary?.unique_departments || 0} color="#0284C7" />
          <StatCard label="KAYITLI ÖĞRETMEN" value={stats?.by_teacher?.length || 0} color="#9B59B6" />
        </div>

        {/* Charts Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {/* Department Distribution */}
          <div className="card">
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 16px', fontSize: '13px' }}>
              Bölüme Göre Dağılım
            </div>
            <div className="card-body" style={{ padding: '0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '200px', overflowY: 'auto' }}>
                {stats?.by_department?.map((dept, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: i < stats.by_department.length - 1 ? '1px solid var(--border-color)' : 'none',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: COLORS[i % COLORS.length],
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {dept.department_name}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: COLORS[i % COLORS.length],
                      minWidth: '30px',
                      textAlign: 'right'
                    }}>
                      {dept.count}
                    </div>
                  </div>
                ))}
                {(!stats?.by_department || stats.by_department.length === 0) && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Bu tarihte kayıt yok
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* YKS Type Chart */}
          <div className="card">
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 16px', fontSize: '13px' }}>
              YKS Türü Dağılımı
            </div>
            <div className="card-body" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '180px' }}>
                <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={0}>
                      <Pie
                        data={stats?.by_type?.map((t, i) => ({ name: typeMapping[t.yks_type] || t.yks_type, value: t.count })) || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        dataKey="value"
                        label={({ name, percent }) => percent > 5 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                        labelStyle={{ fontSize: '10px', fill: 'var(--text-primary)' }}
                      >
                        {stats?.by_type?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ width: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {stats?.by_type?.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], marginRight: '10px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {typeMapping[t.yks_type] || t.yks_type}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Traffic */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 16px', fontSize: '13px' }}>
            Saatlik Kayıt Yoğunluğu
          </div>
          <div className="card-body" style={{ padding: '12px 16px' }}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={stats?.hourly || []}>
                <defs>
                  <linearGradient id="areaGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={true} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${h}:00`}
                  stroke="var(--text-muted)"
                  interval={0}
                  tick={{ fontSize: '10' }}
                  height={35}
                />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: '10' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  labelFormatter={(label) => `${label}:00`}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#areaGradient2)"
                  dot={{ fill: '#fff', r: 3, stroke: '#2563EB', strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: '#2563EB', strokeWidth: 2, fill: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Teacher Statistics */}
        {stats?.by_teacher && stats.by_teacher.length > 0 && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Öğretmen Bazlı Kayıt İstatistikleri</span>
              <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--accent-color)', background: 'rgba(37, 99, 235, 0.1)', padding: '4px 10px', borderRadius: '12px' }}>
                Toplam: {stats.by_teacher.reduce((sum, t) => sum + t.count, 0)}
              </span>
            </div>
            <div className="card-body" style={{ padding: '12px 16px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.by_teacher.map(t => ({ name: t.username, count: t.count }))} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: '11' }} />
                  <YAxis dataKey="name" type="category" width={100} stroke="var(--text-muted)" tick={{ fontSize: '12' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    formatter={(value) => [value, 'Kayıt']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {stats.by_teacher.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tour Requests */}
        {stats?.tour_requests?.length > 0 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 16px', fontSize: '13px' }}>
              Kampüs Turu İstekleri (Bölüme Göre)
            </div>
            <div className="card-body" style={{ padding: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {stats.tour_requests.map((tr, i) => (
                  <div key={i} className="alert alert-warning" style={{ marginBottom: 0, padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400E' }}>{tr.department_name}</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#92400E', lineHeight: '1' }}>{tr.tour_requests}</div>
                    <div style={{ fontSize: '10px', color: '#92400E', opacity: 0.75 }}>toplam: {tr.total_students}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Students Table */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Kayıtlı Öğrenciler ({students.length})</span>
          </div>
          <div className="card-body" style={{ padding: '0' }}>
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card-header-bg)', zIndex: 10 }}>
                  <tr>
                    <th>Öğrenci</th>
                    <th>Bölüm</th>
                    <th>İletişim</th>
                    <th>YKS Türü</th>
                    <th>Kayıt Yapan</th>
                    <th>Saat</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Bu tarihte kayıtlı öğrenci yok
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {student.first_name} {student.last_name}
                          </div>
                        </td>
                        <td>{student.department_name || '-'}</td>
                        <td>
                          {student.email && (
                            <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{student.email}</div>
                          )}
                          {student.phone && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{student.phone}</div>
                          )}
                          {!student.email && !student.phone && '-'}
                        </td>
                        <td>
                          {student.yks_type ? (
                            <span className="badge badge-info">
                              {typeMapping[student.yks_type] || student.yks_type}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          {student.created_by_username ? (
                            <span className="badge badge-secondary" style={{ fontSize: '11px', fontWeight: '500' }}>
                              {student.created_by_username}
                            </span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {formatDateTime(student.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}`, padding: '14px 16px' }}>
      <div className="stat-label" style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px', lineHeight: '1' }}>{value}</div>
    </div>
  )
}

export default DayDashboard
