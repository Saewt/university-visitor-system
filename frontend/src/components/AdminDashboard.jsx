import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatsCards from './StatsCards'
import DepartmentChart from './DepartmentChart'
import StudentForm from './StudentForm'

function AdminDashboard({ user, stats, students, departments, onLogout, onRefresh, onRefreshStudents, onExport }) {
  const [showStudentForm, setShowStudentForm] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterTour, setFilterTour] = useState('')

  const filteredStudents = students.filter(s => {
    const matchesSearch = !searchTerm ||
      s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.phone && s.phone.includes(searchTerm))

    const matchesDept = !filterDept || s.department_id === parseInt(filterDept)
    const matchesTour = filterTour === '' ||
      (filterTour === 'yes' && s.wants_tour) ||
      (filterTour === 'no' && !s.wants_tour)

    return matchesSearch && matchesDept && matchesTour
  })

  const handleExportFiltered = () => {
    const params = {}
    if (filterDept) params.department_id = filterDept
    if (filterTour === 'yes') params.wants_tour = true
    if (filterTour === 'no') params.wants_tour = false
    onExport(params)
  }

  const yksTypeLabel = (type) => {
    const map = {
      'SAYISAL': 'Sayısal',
      'SOZEL': 'Sözel',
      'EA': 'EA',
      'DIL': 'Dil'
    }
    return map[type] || type || '-'
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <span className="navbar-brand">Üniversite Tanıtım Günü - Admin Paneli</span>
        <div className="navbar-nav">
          <span className="text-muted" style={{ fontSize: '14px' }}>
            {user?.username} ({user?.role === 'admin' ? 'Admin' : 'Öğretmen'})
          </span>
          <button className="btn btn-sm btn-outline" onClick={onLogout}>
            Çıkış
          </button>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #dee2e6', padding: '0 20px' }}>
        <div className="container" style={{ display: 'flex', gap: '30px' }}>
          <button
            className="nav-link"
            style={{
              padding: '16px 0',
              borderBottom: activeTab === 'dashboard' ? '3px solid white' : '3px solid transparent',
              marginBottom: activeTab === 'dashboard' ? '-1px' : '0',
              fontWeight: activeTab === 'dashboard' ? '600' : '400'
            }}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className="nav-link"
            style={{
              padding: '16px 0',
              borderBottom: activeTab === 'students' ? '3px solid white' : '3px solid transparent',
              marginBottom: activeTab === 'students' ? '-1px' : '0',
              fontWeight: activeTab === 'students' ? '600' : '400'
            }}
            onClick={() => setActiveTab('students')}
          >
            Öğrenci Listesi
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '20px' }}>
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            <div className="d-flex justify-between align-center mb-4">
              <h2>Genel Bakış</h2>
              <div className="d-flex gap-2">
                <button className="btn btn-outline" onClick={() => setActiveTab('students')}>
                  Öğrenci Ekle
                </button>
                <button className="btn btn-success" onClick={() => onExport()}>
                  <span>&#8659;</span> Excel Dışa Aktar
                </button>
              </div>
            </div>

            <StatsCards summary={stats?.summary} />

            <div className="mt-4">
              <DepartmentChart
                byDepartment={stats?.by_department}
                byType={stats?.by_type}
              />
            </div>

            {/* Hourly Stats */}
            {stats?.hourly && stats.hourly.length > 0 && (
              <div className="card mt-4">
                <div className="card-header">Saatlik Yoğunluk (Bugün)</div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hourData = stats.hourly.find(h => h.hour === i)
                      const count = hourData?.count || 0
                      const maxCount = Math.max(...stats.hourly.map(h => h.count), 1)
                      const height = count > 0 ? Math.max(20, (count / maxCount) * 100) : 4

                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flex: '1',
                            minWidth: '30px',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: `${height}px`,
                              backgroundColor: count > 0 ? '#366092' : '#e9ecef',
                              borderRadius: '4px 4px 0 0',
                              minHeight: '4px',
                              transition: 'height 0.3s'
                            }}
                            title={`${i}:00 - ${count} kayıt`}
                          />
                          <span style={{ fontSize: '10px', color: '#6c757d' }}>{i}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <>
            <div className="d-flex justify-between align-center mb-4">
              <h2>Öğrenci Listesi</h2>
              <div className="d-flex gap-2">
                <button className="btn btn-primary" onClick={() => setShowStudentForm(true)}>
                  + Yeni Öğrenci
                </button>
                <button className="btn btn-success" onClick={handleExportFiltered}>
                  <span>&#8659;</span> Dışa Aktar
                </button>
                <Link to="/register" className="btn btn-outline">
                  Hızlı Kayıt Sayfası
                </Link>
              </div>
            </div>

            {/* Filters */}
            <div className="card mb-4">
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <label className="form-label">Arama</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="İsim, e-posta, telefon..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Bölüm</label>
                    <select
                      className="form-control"
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                    >
                      <option value="">Tümü</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tur İsteği</label>
                    <select
                      className="form-control"
                      value={filterTour}
                      onChange={(e) => setFilterTour(e.target.value)}
                    >
                      <option value="">Tümü</option>
                      <option value="yes">Evet</option>
                      <option value="no">Hayır</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 text-muted" style={{ fontSize: '13px' }}>
                  Toplam {filteredStudents.length} kayıt
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Bölüm</th>
                      <th>Telefon</th>
                      <th>YKS</th>
                      <th>Puan</th>
                      <th>Tur</th>
                      <th>Kayıt Zamanı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          Kayıt bulunamadı
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(student => (
                        <tr key={student.id}>
                          <td>
                            <div style={{ fontWeight: '500' }}>
                              {student.first_name} {student.last_name}
                            </div>
                            {student.email && (
                              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                {student.email}
                              </div>
                            )}
                          </td>
                          <td>{student.department_name || '-'}</td>
                          <td>{student.phone || '-'}</td>
                          <td>{yksTypeLabel(student.yks_type)}</td>
                          <td>{student.yks_score || '-'}</td>
                          <td>
                            {student.wants_tour ? (
                              <span className="badge badge-success">Evet</span>
                            ) : (
                              <span className="badge badge-secondary">Hayır</span>
                            )}
                          </td>
                          <td style={{ fontSize: '13px' }}>
                            {formatDate(student.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Student Form Modal */}
      {showStudentForm && (
        <StudentForm
          onSuccess={() => {
            setShowStudentForm(false)
            onRefreshStudents()
            onRefresh()
          }}
          onCancel={() => setShowStudentForm(false)}
        />
      )}
    </>
  )
}

export default AdminDashboard
