import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, studentsAPI, statsAPI, exportAPI, connectSSE } from '../services/api'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Navbar from '../components/Navbar'
import Management from '../components/Management'

function Admin({ user, onLogout }) {
  const [stats, setStats] = useState(null)
  const [students, setStudents] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')  // Filter by teacher username
  const [filterDate, setFilterDate] = useState('')  // Filter by specific date (YYYY-MM-DD)
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)  // Fixed page size
  const [totalStudents, setTotalStudents] = useState(0)

  // History dates (lazy loading)
  const [historyDates, setHistoryDates] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [mockLoading, setMockLoading] = useState(false)
  const [showDevTools, setShowDevTools] = useState(true)
  const navigate = useNavigate()

  // New: duplicates
  const [duplicates, setDuplicates] = useState([])
  const [showDuplicates, setShowDuplicates] = useState(false)


  // Students pagination - server side
  const [studentsCount, setStudentsCount] = useState(0)
  const [studentsLoading, setStudentsLoading] = useState(false)

  // Period filter for dashboard stats
  const [periodFilter, setPeriodFilter] = useState('today')  // 'today' | 'week' | 'all'
  const [allTimeStats, setAllTimeStats] = useState(null)  // Always show all-time total

  const loadStudents = useCallback(async (page = 1, search = '', dept = '', teacher = '', sortBy = 'created_at', sortOrder = 'desc', selectedDate = '') => {
    setStudentsLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const params = { skip, limit: pageSize, sort_by: sortBy, sort_order: sortOrder }
      if (search) params.search = search
      if (dept) params.department_id = parseInt(dept)
      if (teacher) params.teacher = teacher

      // Add date filter - handle both Date objects and YYYY-MM-DD strings
      if (selectedDate) {
        let date
        if (selectedDate instanceof Date) {
          date = selectedDate
        } else if (typeof selectedDate === 'string' && selectedDate.includes('-')) {
          const [year, month, day] = selectedDate.split('-').map(Number)
          date = new Date(year, month - 1, day)
        } else {
          date = new Date(selectedDate)
        }
        if (!isNaN(date.getTime())) {
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
          params.start_date = startOfDay.toISOString()
          params.end_date = endOfDay.toISOString()
        }
      }

      const response = await studentsAPI.getAll(params)
      // New format: { data: [...], total: N, skip: N, limit: N }
      if (response.data) {
        setStudents(response.data)
        setStudentsCount(response.total)
        setTotalStudents(response.total)
      } else {
        // Legacy format (direct array) - shouldn't happen with new backend
        setStudents(response)
        setStudentsCount(response.length)
        setTotalStudents(response.length)
      }
    } catch (e) {
      console.error('Failed to load students:', e)
    } finally {
      setStudentsLoading(false)
    }
  }, [pageSize])

  const loadData = useCallback(async (skipStats = false) => {
    try {
      const baseRequests = [
        studentsAPI.getDepartments(),
        statsAPI.getDuplicates(50),
        studentsAPI.getHistoryDates()
      ]

      if (skipStats) {
        // When skipping stats, only 3 results
        const [deptsData, duplicatesData, datesData] = await Promise.all(baseRequests)
        setDepartments(deptsData)
        setDuplicates(duplicatesData)
        setHistoryDates(datesData)
      } else {
        // When loading stats, 4 results
        const [statsData, deptsData, duplicatesData, datesData] = await Promise.all([
          statsAPI.getAll(),
          ...baseRequests
        ])
        setStats(statsData)
        setDepartments(deptsData)
        setDuplicates(duplicatesData)
        setHistoryDates(datesData)
      }

      // Load initial students page
      loadStudents(1, searchTerm, filterDept, '', sortColumn, sortDirection)
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setLoading(false)
    }
  }, [loadStudents, searchTerm, filterDept, sortColumn, sortDirection])

  // Load stats based on date filter
  const loadStatsWithFilter = useCallback(async (filter) => {
    try {
      if (filter === 'all') {
        // Use existing stats endpoint for all-time data
        const statsData = await statsAPI.getAll()
        setStats(statsData)
      } else {
        // Calculate date range using YYYY-MM-DD format (backend handles timezone)
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]  // YYYY-MM-DD in UTC
        let startStr = todayStr

        if (filter === 'week') {
          const startDate = new Date(today)
          startDate.setDate(today.getDate() - 6)
          startStr = startDate.toISOString().split('T')[0]
        }

        const rangeData = await statsAPI.getRangeStats(startStr, todayStr)

        // Transform range data to match stats structure
        setStats({
          summary: {
            total_students: rangeData.summary.total_students,
            unique_students: rangeData.summary.total_students,  // Approximate
            today_count: rangeData.summary.total_students,  // Use total as "today" for filtered view
            tour_requests: rangeData.summary.tour_requests,
            unique_departments: rangeData.summary.unique_departments
          },
          data_quality: {
            incomplete_records: 0,  // Not available in range stats
            duplicate_emails: 0,
            duplicate_phones: 0,
            quality_score: 100
          },
          by_department: rangeData.by_department.map(d => ({ department_name: d.department_name, count: d.count })),
          by_type: rangeData.by_type.map(t => ({ yks_type: t.yks_type, count: t.count })),
          tour_requests: rangeData.by_department.map(d => ({
            department_name: d.department_name,
            tour_requests: Math.floor(d.count * 0.2),  // Approximate
            total_students: d.count
          })),
          hourly: rangeData.by_hour.map(h => ({ hour: h.hour, count: h.count })),
          by_teacher: []  // Not available in range stats
        })
      }
    } catch (e) {
      console.error('Failed to load filtered stats:', e)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await studentsAPI.getHistoryDates()
      setHistoryDates(data)
    } catch (e) {
      console.error('Failed to load history dates:', e)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const handleDateClick = (dateStr) => {
    navigate(`/history/day/${dateStr}`)
  }

  const handleCreateMockData = async () => {
    setMockLoading(true)
    try {
      const result = await studentsAPI.createMockData(true, false, false)
      showToast(result.message, 'success')
      loadStatsWithFilter(periodFilter)
      const allTime = await statsAPI.getAll()
      setAllTimeStats(allTime)
      loadHistory()
      loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
    } catch (e) {
      showToast('Demo veri oluşturulamadı', 'error')
    } finally {
      setMockLoading(false)
    }
  }

  const handleLoadTest = async () => {
    if (!confirm('500 öğrenci oluşturulacak (tek gün, 9:00-17:00). Emin misiniz?')) return
    setMockLoading(true)
    try {
      const result = await studentsAPI.createMockData(false, true, false)
      showToast(result.message, 'success')
      loadStatsWithFilter(periodFilter)
      const allTime = await statsAPI.getAll()
      setAllTimeStats(allTime)
      loadHistory()
      loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
    } catch (e) {
      showToast('Load test verisi oluşturulamadı', 'error')
    } finally {
      setMockLoading(false)
    }
  }

  const handleDeleteMockData = async () => {
    if (!confirm('⚠️ TÜM ÖĞRENCİ VERİLERİ SİLİNECEK!\n\nBu işlem geri alınamaz.\n\nDevam etmek istiyor musunuz?')) return
    setMockLoading(true)
    try {
      const result = await studentsAPI.deleteMockData()
      showToast(result.message, 'success')
      loadStatsWithFilter(periodFilter)
      const allTime = await statsAPI.getAll()
      setAllTimeStats(allTime)
      loadHistory()
      loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
    } catch (e) {
      showToast('Demo veriler silinemedi', 'error')
    } finally {
      setMockLoading(false)
    }
  }

  useEffect(() => {
    loadData(true)  // Load initial data, skip stats to avoid race
    loadStatsWithFilter(periodFilter)
    // Load all-time stats for the permanent display card
    statsAPI.getAll().then(setAllTimeStats).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload stats when period filter changes
  useEffect(() => {
    loadStatsWithFilter(periodFilter)
  }, [periodFilter])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'history' && historyDates.length === 0) {
      loadHistory()
    }
  }, [activeTab, historyDates.length, loadHistory])

  // SSE connection
  useEffect(() => {
    const source = connectSSE(
      (event) => {
        if (event.type === 'student_created') {
          showToast('Yeni öğrenci kaydedildi', 'success')
          // Refresh stats based on current filter, not all data
          loadStatsWithFilter(periodFilter)
          // Refresh all-time stats
          statsAPI.getAll().then(setAllTimeStats).catch(console.error)
          // Refresh students list
          loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
          if (activeTab === 'history') {
            loadHistory()
          }
        } else if (event.type === 'student_updated' || event.type === 'student_deleted') {
          // Refresh stats based on current filter, not all data
          loadStatsWithFilter(periodFilter)
          // Refresh all-time stats
          statsAPI.getAll().then(setAllTimeStats).catch(console.error)
          // Refresh students list
          loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
          if (activeTab === 'history') {
            loadHistory()
          }
        }
      },
      (error) => console.error('SSE error:', error)
    )

    return () => {
      if (source) source.close()
    }
  }, [loadStatsWithFilter, loadStudents, loadHistory, activeTab, periodFilter, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate])

  const handleLogout = async () => {
    await authAPI.logout()
    onLogout()
    navigate('/login')
  }

  // Helper to get date range for period
  const getDateRangeForPeriod = (period) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (period) {
      case 'today':
        return { start: today, end: now }
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay()) // Start of week
        return { start: weekStart, end: now }
      case 'all':
      default:
        return { start: null, end: null }
    }
  }

  const handleExport = async (period = 'all') => {
    try {
      const { start, end } = getDateRangeForPeriod(period)
      const params = {}
      if (start) params.start_date = start.toISOString()
      if (end) params.end_date = end.toISOString()

      const response = await exportAPI.exportExcel(params)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const dateStr = new Date().toISOString().split('T')[0]
      const periodSuffix = period === 'all' ? 'tumu' : period === 'today' ? 'bugun' : 'bu_hafta'
      link.setAttribute('download', `ogrenci_raporu_${periodSuffix}_${dateStr}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      const periodLabel = period === 'all' ? 'Tüm' : period === 'today' ? 'Bugünkü' : 'Bu haftaki'
      showToast(`${periodLabel} kayıtlar dışa aktarıldı`, 'success')
    } catch (e) {
      showToast('Dışa aktarım başarısız', 'error')
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSort = (column) => {
    let newDirection = 'asc'
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(newDirection)
    } else {
      setSortColumn(column)
      setSortDirection('asc')
      newDirection = 'asc'
    }
    // Trigger server reload with new sort
    setCurrentPage(1)
    loadStudents(1, searchTerm, filterDept, filterTeacher, column, newDirection)
  }

  // Pagination - server side
  const paginatedStudents = students  // Already paginated from server
  const totalPages = Math.ceil(studentsCount / pageSize)

  // Reset page when filters change - reload from server
  useEffect(() => {
    setCurrentPage(1)
    loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
  }, [searchTerm, filterDept, filterTeacher, filterDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (page) => {
    setCurrentPage(page)
    loadStudents(page, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleTeacherClick = (teacherName) => {
    setFilterTeacher(teacherName)
    setActiveTab('students')
  }

  const clearTeacherFilter = () => {
    setFilterTeacher('')
  }

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateInput) => {
    // Convert to string if it's already a Date object
    const dateStr = dateInput instanceof Date ? dateInput.toISOString().split('T')[0] : String(dateInput)

    // Handle YYYY-MM-DD format from API
    if (dateStr && dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }
    // Fallback for other formats
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="loading-container min-h-screen">
        <div className="spinner spinner-lg"></div>
        <p className="text-muted">Yükleniyor...</p>
      </div>
    )
  }

  const typeMapping = { 'SAYISAL': 'Sayısal', 'SOZEL': 'Sözel', 'EA': 'EA', 'DIL': 'Dil' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Navbar
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showTabs={true}
        showHistoryTab={true}
        showManagementTab={true}
      />

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

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', paddingBottom: '20px' }}>
          {/* Header with Export Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.3px' }}>Admin Paneli</h1>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>Dışa Aktar:</span>
              <div style={{
                display: 'inline-flex',
                background: '#F1F5F9',
                borderRadius: '8px',
                padding: '4px',
                gap: '2px'
              }}>
                {[
                  { key: 'all', label: 'Tümü' },
                  { key: 'today', label: 'Bugün' },
                  { key: 'week', label: 'Bu Hafta' }
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleExport(option.key)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: 'transparent',
                      color: '#64748B',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.color = '#0F172A'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#64748B'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Modern Segmented Control for Date Filter */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'inline-flex',
              background: '#F1F5F9',
              borderRadius: '10px',
              padding: '4px',
              gap: '2px'
            }}>
              {[
                { key: 'today', label: 'Bugün' },
                { key: 'week', label: 'Bu Hafta' }
              ].map((period) => (
                <button
                  key={period.key}
                  onClick={() => setPeriodFilter(period.key)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: periodFilter === period.key ? 'white' : 'transparent',
                    color: periodFilter === period.key ? '#0F172A' : '#64748B',
                    boxShadow: periodFilter === period.key ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                    transition: 'all 0.2s ease',
                    letterSpacing: '0.2px'
                  }}
                  onMouseEnter={(e) => {
                    if (periodFilter !== period.key) {
                      e.currentTarget.style.color = '#475569'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (periodFilter !== period.key) {
                      e.currentTarget.style.color = '#64748B'
                    }
                  }}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Cards - Minimalist Design */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '16px'
          }}>
            {/* Tüm Zamanlar Ziyaretçi Card - Always shows all-time total */}
            <div style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              borderRadius: '12px',
              padding: '20px 24px',
              border: '1px solid #0F172A',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
              transition: 'all 0.2s ease'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 23, 42, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.15)'}
            >
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Tüm Zamanlar Ziyaretçi
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#FFFFFF', lineHeight: '1', letterSpacing: '-1px' }}>
                {allTimeStats?.summary?.total_students ?? stats?.summary?.total_students ?? 0}
              </div>
            </div>

            {/* Kayıtlar Card */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s ease'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)'}
            >
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                {periodFilter === 'week' ? 'Bu Haftaki Kayıtlar' : 'Bugünkü Kayıtlar'}
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#0F172A', lineHeight: '1', letterSpacing: '-1px' }}>
                {stats?.summary?.total_students || 0}
              </div>
            </div>

            {/* Toplam Öğrenci Card */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s ease'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)'}
            >
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                {periodFilter === 'week' ? 'Bu Haftaki Toplam Öğrenci' : 'Toplam Öğrenci'}
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#0F172A', lineHeight: '1', letterSpacing: '-1px' }}>
                {stats?.summary?.unique_students || 0}
              </div>
            </div>

            {/* Kampüs Turu İsteği Card */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s ease'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)'}
            >
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                {periodFilter === 'week' ? 'Bu Haftaki Kampüs Turu' : 'Kampüs Turu İsteği'}
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#0F172A', lineHeight: '1', letterSpacing: '-1px' }}>
                {stats?.summary?.tour_requests || 0}
              </div>
            </div>
          </div>

          {/* Alert Banner - Thin Orange Strip */}
          {duplicates.length > 0 && !showDuplicates && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, #FEF3C7 0%, #FDE68A 100%)',
              border: '1px solid #FCD34D',
              borderRadius: '8px',
              padding: '10px 16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#78350F' }}>
                  {duplicates.length} Yinelenen Kayıt Bulundu
                </span>
              </div>
              <button
                onClick={() => setShowDuplicates(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  color: '#92400E',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(146, 64, 14, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Mock Data Panel - Admin Testing Tools */}
          {user?.role === 'admin' && (
            <div style={{
              background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
              border: '1px solid #BFDBFE',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E3A8A' }}>Test Verileri Oluştur</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Sistemi test etmek için örnek veriler</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDevTools(!showDevTools)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2563EB',
                    background: 'white',
                    border: '1px solid #BFDBFE',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  {showDevTools ? 'Gizle' : 'Göster'}
                </button>
              </div>

              {showDevTools && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '10px',
                  paddingTop: '4px'
                }}>
                  {/* Demo Data - 150 students, 30 days */}
                  <button
                    onClick={handleCreateMockData}
                    disabled={mockLoading}
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'white',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: mockLoading ? 'not-allowed' : 'pointer',
                      opacity: mockLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => !mockLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20V10" />
                        <path d="M18 20V4" />
                        <path d="M6 20v-4" />
                      </svg>
                      Demo Veri (150)
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '400', opacity: 0.9 }}>
                      30 günlük gerçekçi veri
                    </div>
                  </button>

                  {/* Load Test - 500 students, 1 day */}
                  <button
                    onClick={handleLoadTest}
                    disabled={mockLoading}
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'white',
                      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: mockLoading ? 'not-allowed' : 'pointer',
                      opacity: mockLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => !mockLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      Load Test (500)
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '400', opacity: 0.9 }}>
                      Yoğun gün simülasyonu
                    </div>
                  </button>

                  {/* Simple Test - 20 students */}
                  <button
                    onClick={() => {
                      setMockLoading(true)
                      studentsAPI.createMockData(false, false, false)
                        .then(result => {
                          showToast(result.message || '20 öğrenci oluşturuldu', 'success')
                          loadStatsWithFilter(periodFilter)
                          loadHistory()
                          loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
                        })
                        .catch(() => showToast('Basit test verisi oluşturulamadı', 'error'))
                        .finally(() => setMockLoading(false))
                    }}
                    disabled={mockLoading}
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'white',
                      background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: mockLoading ? 'not-allowed' : 'pointer',
                      opacity: mockLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => !mockLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                      Hızlı Test (20)
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '400', opacity: 0.9 }}>
                      5 günlük basit veri
                    </div>
                  </button>

                  {/* Weekly Test - 70 students, 7 days */}
                  <button
                    onClick={() => {
                      setMockLoading(true)
                      studentsAPI.createMockData(false, false, true)
                        .then(result => {
                          showToast(result.message || '70 öğrenci oluşturuldu', 'success')
                          loadStatsWithFilter(periodFilter)
                          loadHistory()
                          loadStudents(1, searchTerm, filterDept, filterTeacher, sortColumn, sortDirection, filterDate)
                        })
                        .catch(() => showToast('Haftalık test verisi oluşturulamadı', 'error'))
                        .finally(() => setMockLoading(false))
                    }}
                    disabled={mockLoading}
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'white',
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: mockLoading ? 'not-allowed' : 'pointer',
                      opacity: mockLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => !mockLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Haftalık Test (70)
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '400', opacity: 0.9 }}>
                      7 günlük gerçekçi veri
                    </div>
                  </button>

                  {/* Delete All Data */}
                  <button
                    onClick={handleDeleteMockData}
                    disabled={mockLoading}
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#DC2626',
                      background: 'white',
                      border: '1px solid #FECACA',
                      borderRadius: '8px',
                      cursor: mockLoading ? 'not-allowed' : 'pointer',
                      opacity: mockLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => !mockLoading && (e.currentTarget.style.background = '#FEF2F2')}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Verileri Temizle
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '400', color: '#EF4444' }}>
                      Tüm öğrencileri sil
                    </div>
                  </button>
                </div>
              )}

              {mockLoading && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#64748B'
                }}>
                  <div className="spinner spinner-sm" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                  <span>İşlem gerçekleştiriliyor...</span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Section - Split View */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* En Popüler Bölümler - Left Panel */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}>
              <div style={{
                borderBottom: '1px solid #E2E8F0',
                padding: '14px 18px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#0F172A',
                letterSpacing: '0.2px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>En Popüler Bölümler</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top 5</span>
              </div>
              <div style={{ padding: '16px 18px' }}>
                {stats?.by_department?.slice(0, 5).map((dept, i) => {
                  const maxCount = stats.by_department[0].count
                  const percent = maxCount > 0 ? (dept.count / maxCount) * 100 : 0
                  return (
                    <div key={i} style={{ marginBottom: i < 4 ? '16px' : '0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#334155' }}>{dept.department_name}</span>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#2563EB' }}>{dept.count}</span>
                      </div>
                      <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #2563EB 0%, #3B82F6 100%)',
                          borderRadius: '6px',
                          width: `${percent}%`,
                          transition: 'width 0.4s ease',
                          boxShadow: percent > 0 ? '0 1px 3px rgba(37, 99, 235, 0.3)' : 'none'
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Saatlik Kayıt Yoğunluğu - Right Panel */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}>
              <div style={{
                borderBottom: '1px solid #E2E8F0',
                padding: '14px 18px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#0F172A',
                letterSpacing: '0.2px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Saatlik Kayıt Yoğunluğu</span>
                {stats?.hourly && stats.hourly.length > 0 && (() => {
                  const peakHour = stats.hourly.reduce((max, h) => h.count > max.count ? h : max, stats.hourly[0])
                  if (peakHour.count > 0) {
                    return (
                      <span style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#FEF3C7',
                        color: '#92400E',
                        fontWeight: '600'
                      }}>
                        {peakHour.hour}:00 - {peakHour.count} öğrenci gün içi rekoru
                      </span>
                    )
                  }
                  return null
                })()}
              </div>
              <div style={{ padding: '12px 16px 16px' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={stats?.hourly || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F172A" stopOpacity={0.2} />
                        <stop offset="50%" stopColor="#0F172A" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="#0F172A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="2 2"
                      stroke="#E2E8F0"
                      horizontal={true}
                      vertical={false}
                      opacity={0.6}
                    />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => `${h}:00`}
                      stroke="#94A3B8"
                      interval={0}
                      tick={{ fontSize: '10', fontWeight: '500' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      tick={{ fontSize: '10', fontWeight: '500' }}
                      width={28}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '500',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        padding: '8px 12px'
                      }}
                      labelFormatter={(label) => `${label}:00`}
                      itemStyle={{ color: '#0F172A' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#0F172A"
                      strokeWidth={2.5}
                      fill="url(#chartGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#0F172A', stroke: 'white', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Students Tab - Redesigned */}
      {activeTab === 'students' && (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
          {/* Header */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.3px' }}>Öğrenci Listesi</h1>
          </div>

          {/* Filter Bar - Streamlined Single Row */}
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '12px 16px',
            border: '1px solid #E2E8F0',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {/* Search Input with Icon */}
            <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Öğrenci ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  fontSize: '13px',
                  fontWeight: '400',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.borderColor = '#0F172A'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = '#F8FAFC'
                  e.currentTarget.style.borderColor = '#E2E8F0'
                }}
              />
            </div>

            {/* Department Dropdown */}
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{
                padding: '10px 32px 10px 12px',
                fontSize: '13px',
                fontWeight: '500',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                background: 'white',
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 8L2 4L6 0L10 4L6 8Z' fill='%2364748B'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                minWidth: '160px'
              }}
            >
              <option value="">Bölüm Seçiniz</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Date Filter Dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{
                  padding: '10px 32px 10px 36px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  backgroundColor: filterDate ? '#0F172A' : 'white',
                  color: filterDate ? 'white' : '#0F172A',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 8L2 4L6 0L10 4L6 8Z' fill='${encodeURIComponent(filterDate ? '%23FFFFFF' : '%2364748B')}'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  minWidth: '160px',
                  transition: 'all 0.2s ease'
                }}
              >
                <option value="">Tarih Seçiniz</option>
                {historyDates.map(item => {
                  const dateStr = item.date_iso || item.date || String(item)
                  return (
                    <option key={dateStr} value={dateStr}>{item.date || dateStr} ({item.count || 0} kayıt)</option>
                  )
                })}
              </select>
              {/* Calendar Icon */}
              <svg
                width="14" height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={filterDate ? 'white' : 'currentColor'}
                strokeWidth="2"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: filterDate ? 'white' : '#64748B',
                  pointerEvents: 'none'
                }}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>

            {/* Active Filters */}
            {(searchTerm || filterDept || filterTeacher || filterDate) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {searchTerm && (
                  <span style={{
                    fontSize: '12px',
                    padding: '4px 8px 4px 10px',
                    background: '#F1F5F9',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#475569'
                  }}>
                    "{searchTerm}"
                    <span onClick={() => setSearchTerm('')} style={{
                      cursor: 'pointer',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>×</span>
                  </span>
                )}
                {filterDept && (
                  <span style={{
                    fontSize: '12px',
                    padding: '4px 8px 4px 10px',
                    background: '#F1F5F9',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#475569'
                  }}>
                    {departments.find(d => d.id === parseInt(filterDept))?.name || filterDept}
                    <span onClick={() => setFilterDept('')} style={{
                      cursor: 'pointer',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>×</span>
                  </span>
                )}
                {filterTeacher && (
                  <span style={{
                    fontSize: '12px',
                    padding: '4px 8px 4px 10px',
                    background: 'rgba(15, 23, 42, 0.08)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#0F172A'
                  }}>
                    {filterTeacher}
                    <span onClick={clearTeacherFilter} style={{
                      cursor: 'pointer',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>×</span>
                  </span>
                )}
                {filterDate && (
                  <span style={{
                    fontSize: '12px',
                    padding: '4px 8px 4px 10px',
                    background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#92400E',
                    fontWeight: '600'
                  }}>
                    {formatDate(filterDate)}
                    <span onClick={() => setFilterDate('')} style={{
                      cursor: 'pointer',
                      color: '#92400E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700'
                    }}>×</span>
                  </span>
                )}
              </div>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Clear Filters Ghost Button */}
            {(searchTerm || filterDept || filterTeacher || filterDate) && (
              <button
                onClick={() => { setSearchTerm(''); setFilterDept(''); setFilterTeacher(''); setFilterDate('') }}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#64748B',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#0F172A'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#64748B'}
              >
                Filtreleri Temizle
              </button>
            )}
          </div>

          {/* Date Filter Info Banner */}
          {filterDate && (
            <div style={{
              background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
              border: '1px solid #FCD34D',
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#78350F' }}>
                    {formatDate(filterDate)} tarihinin tüm kayıtları
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#92400E', marginLeft: '8px' }}>
                    ({studentsCount} öğrenci)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setFilterDate('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  color: '#92400E',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(146, 64, 14, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Data Table - Professional Design */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ overflowX: 'auto', minWidth: '900px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                {/* Table Header */}
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    {[
                      { key: 'name', label: 'Öğrenci', width: '18%', sortKey: 'first_name' },
                      { key: 'contact', label: 'İletişim', width: '22%', sortKey: null },
                      { key: 'yks', label: 'YKS Sıralaması', width: '16%', sortKey: 'ranking' },
                      { key: 'teacher', label: 'Kayıt Yapan', width: '16%', sortKey: null },
                      { key: 'tour', label: 'Kampüs Turu', width: '12%', sortKey: 'wants_tour' },
                      { key: 'time', label: 'Kayıt Zamanı', width: '16%', sortKey: 'created_at' }
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => col.sortKey && handleSort(col.sortKey)}
                        style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: sortColumn === col.sortKey ? '#0F172A' : '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          background: sortColumn === col.sortKey ? '#E2E8F0' : '#F8FAFC',
                          width: col.width,
                          cursor: col.sortKey ? 'pointer' : 'default',
                          userSelect: 'none',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (col.sortKey) {
                            e.currentTarget.style.background = '#E2E8F0'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (col.sortKey) {
                            e.currentTarget.style.background = sortColumn === col.sortKey ? '#E2E8F0' : '#F8FAFC'
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {col.label}
                          {col.sortKey && (
                            <span style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              fontSize: '8px',
                              lineHeight: '6px',
                              opacity: sortColumn === col.sortKey ? 1 : 0.4
                            }}>
                              <span style={{
                                color: sortColumn === col.sortKey && sortDirection === 'asc' ? '#0F172A' : '#94A3B8'
                              }}>▲</span>
                              <span style={{
                                color: sortColumn === col.sortKey && sortDirection === 'desc' ? '#0F172A' : '#94A3B8'
                              }}>▼</span>
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth="1.5">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                          </svg>
                          <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '500' }}>
                            Kayıt bulunamadı
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    students.map((student, index) => (
                      <tr
                        key={student.id}
                        style={{
                          borderBottom: index < students.length - 1 ? '1px solid #F1F5F9' : 'none',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Öğrenci */}
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>
                            {student.first_name} {student.last_name}
                          </div>
                          {student.department_name && (
                            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                              {student.department_name}
                            </div>
                          )}
                        </td>

                        {/* İletişim */}
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {student.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                  <polyline points="22,6 12,13 2,6" />
                                </svg>
                                <span style={{ fontSize: '13px', color: '#475569' }}>{student.email}</span>
                              </div>
                            )}
                            {student.phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                <span style={{ fontSize: '12px', color: '#64748B' }}>{student.phone}</span>
                              </div>
                            )}
                            {!student.email && !student.phone && (
                              <span style={{ fontSize: '13px', color: '#CBD5E1' }}>-</span>
                            )}
                          </div>
                        </td>

                        {/* YKS Sıralaması */}
                        <td style={{ padding: '16px' }}>
                          {student.yks_type || student.ranking ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {student.yks_type && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: '#DBEAFE',
                                  color: '#1E40AF',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  alignSelf: 'flex-start',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {typeMapping[student.yks_type] || student.yks_type}
                                </span>
                              )}
                              {student.ranking && (
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#475569'
                                }}>
                                  {Number(student.ranking).toLocaleString('tr-TR')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '13px', color: '#CBD5E1' }}>-</span>
                          )}
                        </td>

                        {/* Kayıt Yapan */}
                        <td style={{ padding: '16px' }}>
                          {student.created_by_username ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>
                                {student.created_by_username.charAt(0).toUpperCase()}
                              </div>
                              <span style={{
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#334155',
                                textTransform: 'capitalize'
                              }}>
                                {student.created_by_username}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '13px', color: '#CBD5E1' }}>-</span>
                          )}
                        </td>

                        {/* Kampüs Turu */}
                        <td style={{ padding: '16px' }}>
                          {student.wants_tour ? (
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: '#DCFCE7',
                              color: '#166534'
                            }}>
                              Evet
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '500',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: '#F1F5F9',
                              color: '#64748B'
                            }}>
                              Hayır
                            </span>
                          )}
                        </td>

                        {/* Kayıt Zamanı */}
                        <td style={{ padding: '16px' }}>
                          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '400' }}>
                            {formatDateTime(student.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination - Sleek Design */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #E2E8F0'
          }}>
            {/* Total Results */}
            <div style={{ fontSize: '13px', color: '#64748B' }}>
              Toplam <span style={{ fontWeight: '600', color: '#0F172A' }}>{studentsCount}</span> kayıt
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    background: 'white',
                    color: currentPage === 1 ? '#CBD5E1' : '#475569',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = '#F8FAFC'
                      e.currentTarget.style.borderColor = '#CBD5E1'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.borderColor = '#E2E8F0'
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Önceki
                </button>

                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: currentPage === pageNum ? '1px solid #0F172A' : '1px solid #E2E8F0',
                        borderRadius: '8px',
                        background: currentPage === pageNum ? '#0F172A' : 'white',
                        color: currentPage === pageNum ? 'white' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        minWidth: '40px'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== pageNum) {
                          e.currentTarget.style.background = '#F8FAFC'
                          e.currentTarget.style.borderColor = '#CBD5E1'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== pageNum) {
                          e.currentTarget.style.background = 'white'
                          e.currentTarget.style.borderColor = '#E2E8F0'
                        }
                      }}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    background: 'white',
                    color: currentPage === totalPages ? '#CBD5E1' : '#475569',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = '#F8FAFC'
                      e.currentTarget.style.borderColor = '#CBD5E1'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.borderColor = '#E2E8F0'
                    }
                  }}
                >
                  Sonraki
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}

            {/* Spacer when no pagination */}
            {totalPages <= 1 && <div />}
          </div>
        </div>
      )}

      {/* History Tab - Improved UI */}
      {activeTab === 'history' && (
        <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Kayıt Geçmişi</h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {historyDates.reduce((sum, d) => sum + d.count, 0)} toplam kayıt • {historyDates.length} gün
              </p>
            </div>
          </div>



          {historyLoading ? (
            <div style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div className="spinner spinner-lg"></div>
              <p className="text-muted" style={{ marginTop: '12px' }}>Yükleniyor...</p>
            </div>
          ) : historyDates.length === 0 ? (
            <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--hover-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="text-muted" style={{ fontSize: '14px' }}>Henüz kayıt geçmişi bulunmuyor</p>
            </div>
          ) : (
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              {/* History List */}
              <div>
                {(() => {
                  // Helper to parse date from either ISO format or DD.MM.YYYY
                  const parseDate = (dateStr, isoDate) => {
                    if (isoDate) return new Date(isoDate)
                    // Parse DD.MM.YYYY format
                    const parts = dateStr.split('.')
                    if (parts.length === 3) {
                      return new Date(parts[2], parts[1] - 1, parts[0])
                    }
                    return new Date(dateStr)
                  }

                  // Group by month
                  const grouped = {}
                  historyDates.forEach(item => {
                    const date = parseDate(item.date, item.date_iso)
                    if (isNaN(date.getTime())) return // Skip invalid dates
                    const monthKey = date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
                    if (!grouped[monthKey]) grouped[monthKey] = []
                    grouped[monthKey].push({ ...item, parsedDate: date })
                  })

                  // Sort months descending
                  const sortedMonths = Object.keys(grouped).sort((a, b) => {
                    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
                    const [aMonth, aYear] = a.split(' ')
                    const [bMonth, bYear] = b.split(' ')
                    if (aYear !== bYear) return bYear - aYear
                    return months.indexOf(bMonth) - months.indexOf(aMonth)
                  })

                  return sortedMonths.map((monthKey, idx) => (
                    <div key={monthKey}>
                      {/* Month Header - Subtle Divider Style */}
                      <div style={{
                        padding: '10px 20px',
                        background: '#FAFBFC',
                        borderBottom: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1
                      }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {monthKey}
                        </span>
                        <div style={{
                          flex: 1,
                          height: '1px',
                          background: '#E2E8F0'
                        }} />
                        <span style={{
                          fontSize: '11px',
                          color: '#94A3B8',
                          fontWeight: '500'
                        }}>
                          {grouped[monthKey].reduce((sum, d) => sum + d.count, 0)} öğrenci
                        </span>
                      </div>

                      {/* Days in month - Compact Timeline Design */}
                      {grouped[monthKey]
                        .sort((a, b) => b.parsedDate - a.parsedDate)
                        .map((dateItem, dayIdx) => {
                          const date = dateItem.parsedDate
                          const dayName = date.toLocaleDateString('tr-TR', { weekday: 'long' })
                          const dayNum = date.getDate()
                          const monthName = date.toLocaleDateString('tr-TR', { month: 'short' })
                          const isToday = new Date().toDateString() === date.toDateString()
                          const isYesterday = new Date(Date.now() - 86400000).toDateString() === date.toDateString()

                          return (
                            <div
                              key={dateItem.date}
                              onClick={() => handleDateClick(dateItem.date)}
                              style={{
                                padding: '10px 20px',
                                borderBottom: dayIdx < grouped[monthKey].length - 1 ? '1px solid #F1F5F9' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s ease',
                                background: isToday ? 'rgba(5, 150, 105, 0.04)' :
                                  isYesterday ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                                borderLeft: isToday ? '3px solid #059669' :
                                  isYesterday ? '3px solid #2563EB' : '3px solid transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (!isToday && !isYesterday) {
                                  e.currentTarget.style.backgroundColor = '#F8FAFC'
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isToday ? 'rgba(5, 150, 105, 0.04)' :
                                  isYesterday ? 'rgba(37, 99, 235, 0.03)' : 'transparent'
                              }}
                            >
                              {/* Left: Date + Day Name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* Stacked Date (Day Number + Month) */}
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  minWidth: '40px'
                                }}>
                                  <span style={{
                                    fontSize: '22px',
                                    fontWeight: '700',
                                    color: isToday ? '#059669' : isYesterday ? '#2563EB' : '#0F172A',
                                    lineHeight: '1',
                                    fontVariantNumeric: 'tabular-nums'
                                  }}>
                                    {dayNum}
                                  </span>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    color: isToday ? '#059669' : isYesterday ? '#2563EB' : '#94A3B8',
                                    textTransform: 'capitalize',
                                    marginTop: '2px'
                                  }}>
                                    {monthName}
                                  </span>
                                </div>

                                {/* Day Name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isToday && (
                                    <span style={{
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      background: '#059669',
                                      boxShadow: '0 0 0 2px rgba(5, 150, 105, 0.2)',
                                      animation: 'pulse 2s ease-in-out infinite'
                                    }} />
                                  )}
                                  <span style={{
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#334155',
                                    textTransform: 'capitalize'
                                  }}>
                                    {dayName}
                                  </span>
                                </div>
                              </div>

                              {/* Right: Count + Chevron */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                              }}>
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  color: '#64748B',
                                  fontVariantNumeric: 'tabular-nums'
                                }}>
                                  {dateItem.count} Öğrenci
                                </span>
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#94A3B8"
                                  strokeWidth="2"
                                  style={{ opacity: 0.6 }}
                                >
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Management Tab - User & Department Management */}
      {activeTab === 'management' && (
        <Management showToast={showToast} currentUser={user} />
      )}
    </div>
  )
}

function SortableHeader({ column, label, sortColumn, sortDirection, onSort }) {
  const isSorted = sortColumn === column
  return (
    <th
      onClick={() => onSort(column)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        fontWeight: '600',
        fontSize: '12px',
        color: isSorted ? 'var(--accent-color)' : 'var(--text-secondary)',
        backgroundColor: isSorted ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
        transition: 'background-color 0.15s ease'
      }}
      onMouseEnter={(e) => {
        if (!isSorted) e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
      }}
      onMouseLeave={(e) => {
        if (!isSorted) e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}
        <span style={{ fontSize: '10px', opacity: isSorted ? 1 : 0.5 }}>
          {isSorted ? (
            sortDirection === 'asc' ? '↑' : '↓'
          ) : (
            '↕'
          )}
        </span>
      </div>
    </th>
  )
}

export default Admin
