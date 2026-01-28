import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Token management
export const getToken = () => localStorage.getItem('token')
export const setToken = (token) => localStorage.setItem('token', token)
export const removeToken = () => localStorage.removeItem('token')
export const getUser = () => {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}
export const setUser = (user) => localStorage.setItem('user', JSON.stringify(user))
export const removeUser = () => localStorage.removeItem('user')

// Auth API
export const authAPI = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password })
    setToken(response.data.access_token)
    setUser(response.data.user)
    return response.data
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      removeToken()
      removeUser()
    }
  },

  getMe: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },
}

// Students API
export const studentsAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/students', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/students/${id}`)
    return response.data
  },

  create: async (studentData) => {
    const response = await api.post('/students', studentData)
    return response.data
  },

  update: async (id, studentData) => {
    const response = await api.put(`/students/${id}`, studentData)
    return response.data
  },

  delete: async (id) => {
    await api.delete(`/students/${id}`)
  },

  getDepartments: async () => {
    const response = await api.get('/students/departments/list')
    return response.data
  },

  getHistory: async (limit = 100) => {
    const response = await api.get('/students/history', { params: { limit } })
    return response.data
  },

  getHistoryDates: async () => {
    const response = await api.get('/students/history/dates')
    return response.data
  },

  getHistoryByDate: async (dateStr, limit = 100) => {
    const response = await api.get(`/students/history/by-date/${dateStr}`, { params: { limit } })
    return response.data
  },

  createMockData: async (demo = false, loadTest = false, weekly = false) => {
    const params = {}
    if (demo) params.demo = true
    if (loadTest) params.load_test = true
    if (weekly) params.weekly = true
    const response = await api.post('/students/mock-data', null, { params })
    return response.data
  },

  deleteMockData: async () => {
    const response = await api.delete('/students/mock-data', { params: { confirm: true } })
    return response.data
  },

  checkDuplicate: async (email, phone) => {
    const params = {}
    if (email) params.email = email
    if (phone) params.phone = phone
    const response = await api.get('/students/check-duplicate', { params })
    return response.data
  },
}

// Stats API
export const statsAPI = {
  getSummary: async () => {
    const response = await api.get('/stats/summary')
    return response.data
  },

  getByDepartment: async (limit = 10) => {
    const response = await api.get('/stats/by-department', { params: { limit } })
    return response.data
  },

  getByType: async () => {
    const response = await api.get('/stats/by-type')
    return response.data
  },

  getTourRequests: async () => {
    const response = await api.get('/stats/tour-requests')
    return response.data
  },

  getHourly: async (days = 1) => {
    const response = await api.get('/stats/hourly', { params: { days } })
    return response.data
  },

  getByTeacher: async () => {
    const response = await api.get('/stats/by-teacher')
    return response.data
  },

  getDayStats: async (dateStr) => {
    const response = await api.get(`/stats/day/${dateStr}`)
    return response.data
  },

  getAll: async () => {
    const response = await api.get('/stats')
    return response.data
  },

  // New endpoints
  getComparison: async (startDate, endDate, compareWith = 'yesterday') => {
    const params = { compare_with: compareWith }
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const response = await api.get('/stats/comparison', { params })
    return response.data
  },

  getRangeStats: async (startDate, endDate) => {
    const response = await api.get('/stats/range', { params: { start_date: startDate, end_date: endDate } })
    return response.data
  },

  getHeatmap: async (days = 30) => {
    const response = await api.get('/stats/heatmap', { params: { days } })
    return response.data
  },

  getDepartmentTrends: async (days = 30, limit = 10) => {
    const response = await api.get('/stats/department-trends', { params: { days, limit } })
    return response.data
  },

  getDuplicates: async (limit = 50) => {
    const response = await api.get('/stats/duplicates', { params: { limit } })
    return response.data
  },

  getFunnel: async () => {
    const response = await api.get('/stats/funnel')
    return response.data
  },
}

// Export API
export const exportAPI = {
  exportExcel: async (params = {}) => {
    const response = await api.get('/export/excel', {
      params,
      responseType: 'blob',
    })
    return response
  },

  exportDaily: async (date) => {
    const response = await api.get(`/export/daily/${date}`, {
      responseType: 'blob',
    })
    return response
  },
}

// Management API (Admin only - User & Department Management)
export const managementAPI = {
  // Users
  getUsers: async (params = {}) => {
    const response = await api.get('/management/users', { params })
    return response.data
  },

  getUser: async (id) => {
    const response = await api.get(`/management/users/${id}`)
    return response.data
  },

  createUser: async (userData) => {
    const response = await api.post('/management/users', userData)
    return response.data
  },

  updateUser: async (id, userData) => {
    const response = await api.put(`/management/users/${id}`, userData)
    return response.data
  },

  deleteUser: async (id) => {
    await api.delete(`/management/users/${id}`)
  },

  // Departments
  getDepartments: async (params = {}) => {
    const response = await api.get('/management/departments', { params })
    return response.data
  },

  getDepartment: async (id) => {
    const response = await api.get(`/management/departments/${id}`)
    return response.data
  },

  createDepartment: async (deptData) => {
    const response = await api.post('/management/departments', deptData)
    return response.data
  },

  updateDepartment: async (id, deptData) => {
    const response = await api.put(`/management/departments/${id}`, deptData)
    return response.data
  },

  deleteDepartment: async (id) => {
    await api.delete(`/management/departments/${id}`)
  },
}

// SSE Connection
export const connectSSE = (onMessage, onError) => {
  const token = getToken()
  const url = new URL(`${API_BASE_URL}/events`, window.location.origin)

  const eventSource = new EventSource(url)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (e) {
      console.error('Failed to parse SSE event:', e)
    }
  }

  eventSource.onerror = (error) => {
    console.error('SSE error:', error)
    if (onError) onError(error)
  }

  return eventSource
}

export default api
