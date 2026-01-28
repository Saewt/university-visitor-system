/**
 * Tests for API service module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import * as api from '../src/services/api'

// Mock axios
vi.mock('axios')

describe('API Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Token Management', () => {
    it('should set and get token', () => {
      api.setToken('test-token')
      expect(api.getToken()).toBe('test-token')
      expect(localStorage.getItem('token')).toBe('test-token')
    })

    it('should remove token', () => {
      api.setToken('test-token')
      api.removeToken()
      expect(api.getToken()).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('should get token from localStorage', () => {
      localStorage.setItem('token', 'existing-token')
      expect(api.getToken()).toBe('existing-token')
    })
  })

  describe('User Management', () => {
    it('should set and get user', () => {
      const testUser = { id: 1, username: 'testuser', role: 'admin' }
      api.setUser(testUser)
      expect(api.getUser()).toEqual(testUser)
    })

    it('should return null when user not exists', () => {
      expect(api.getUser()).toBeNull()
    })

    it('should remove user', () => {
      const testUser = { id: 1, username: 'testuser' }
      api.setUser(testUser)
      api.removeUser()
      expect(api.getUser()).toBeNull()
    })
  })

  describe('authAPI', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-token',
          user: { id: 1, username: 'admin', role: 'admin' }
        }
      }
      axios.create.mockReturnValue({
        post: vi.fn().mockResolvedValue(mockResponse)
      })

      // Recreate api instance to get the mock
      const result = await api.authAPI.login('admin', 'admin123')

      expect(result.access_token).toBe('test-token')
      expect(localStorage.getItem('token')).toBe('test-token')
      expect(localStorage.getItem('user')).toBeTruthy()
    })

    it('should logout and clear storage', async () => {
      const mockApi = {
        post: vi.fn().mockResolvedValue({})
      }
      axios.create.mockReturnValue(mockApi)

      api.setToken('test-token')
      api.setUser({ id: 1 })

      await api.authAPI.logout()

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
    })

    it('should handle logout error even if API fails', async () => {
      const mockApi = {
        post: vi.fn().mockRejectedValue(new Error('Network error'))
      }
      axios.create.mockReturnValue(mockApi)

      api.setToken('test-token')
      api.setUser({ id: 1 })

      // Should not throw, still clear storage
      await expect(api.authAPI.logout()).resolves.not.toThrow()
      expect(localStorage.getItem('token')).toBeNull()
    })
  })

  describe('studentsAPI', () => {
    it('should get all students', async () => {
      const mockStudents = [
        { id: 1, first_name: 'Ahmet', last_name: 'Yılmaz' },
        { id: 2, first_name: 'Mehmet', last_name: 'Demir' }
      ]
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockStudents })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.studentsAPI.getAll()

      expect(result).toEqual(mockStudents)
      expect(mockApi.get).toHaveBeenCalledWith('/students', { params: {} })
    })

    it('should get students with filters', async () => {
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: [] })
      }
      axios.create.mockReturnValue(mockApi)

      await api.studentsAPI.getAll({ department_id: 1, limit: 50 })

      expect(mockApi.get).toHaveBeenCalledWith('/students', {
        params: { department_id: 1, limit: 50 }
      })
    })

    it('should get student by ID', async () => {
      const mockStudent = { id: 1, first_name: 'Ahmet' }
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockStudent })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.studentsAPI.getById(1)

      expect(result).toEqual(mockStudent)
      expect(mockApi.get).toHaveBeenCalledWith('/students/1')
    })

    it('should create student', async () => {
      const newStudent = { first_name: 'Test', last_name: 'Student' }
      const createdStudent = { id: 1, ...newStudent }
      const mockApi = {
        post: vi.fn().mockResolvedValue({ data: createdStudent })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.studentsAPI.create(newStudent)

      expect(result).toEqual(createdStudent)
      expect(mockApi.post).toHaveBeenCalledWith('/students', newStudent)
    })

    it('should update student', async () => {
      const updateData = { first_name: 'Updated' }
      const updatedStudent = { id: 1, first_name: 'Updated', last_name: 'Student' }
      const mockApi = {
        put: vi.fn().mockResolvedValue({ data: updatedStudent })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.studentsAPI.update(1, updateData)

      expect(result).toEqual(updatedStudent)
      expect(mockApi.put).toHaveBeenCalledWith('/students/1', updateData)
    })

    it('should delete student', async () => {
      const mockApi = {
        delete: vi.fn().mockResolvedValue({})
      }
      axios.create.mockReturnValue(mockApi)

      await api.studentsAPI.delete(1)

      expect(mockApi.delete).toHaveBeenCalledWith('/students/1')
    })

    it('should get departments', async () => {
      const mockDepts = [
        { id: 1, name: 'Tıp' },
        { id: 2, name: 'Hukuk' }
      ]
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockDepts })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.studentsAPI.getDepartments()

      expect(result).toEqual(mockDepts)
    })

    it('should create mock data', async () => {
      const mockResponse = { message: 'Created 20 demo students' }
      const mockApi = {
        post: vi.fn().mockResolvedValue({ data: mockResponse })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.studentsAPI.createMockData(false)

      expect(result).toEqual(mockResponse)
    })
  })

  describe('statsAPI', () => {
    it('should get summary stats', async () => {
      const mockStats = { total_students: 100, today_count: 10 }
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockStats })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.statsAPI.getSummary()

      expect(result).toEqual(mockStats)
    })

    it('should get all stats', async () => {
      const mockStats = {
        summary: { total_students: 100 },
        by_department: [],
        by_type: []
      }
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockStats })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.statsAPI.getAll()

      expect(result).toEqual(mockStats)
    })

    it('should get comparison stats', async () => {
      const mockComparison = {
        current_period: { count: 10 },
        compare_period: { count: 5 },
        growth: { absolute: 5, percentage: 100 }
      }
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockComparison })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.statsAPI.getComparison('2024-01-01', '2024-01-31')

      expect(result).toEqual(mockComparison)
    })

    it('should get heatmap data', async () => {
      const mockHeatmap = {
        data: [{ day_of_week: 1, hour: 10, count: 5 }],
        max_count: 10
      }
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockHeatmap })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.statsAPI.getHeatmap(30)

      expect(result).toEqual(mockHeatmap)
    })
  })

  describe('exportAPI', () => {
    it('should export excel with blob response', async () => {
      const mockBlob = new Blob(['test data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const mockApi = {
        get: vi.fn().mockResolvedValue({ data: mockBlob })
      }
      axios.create.mockReturnValue(mockApi)

      const result = await api.exportAPI.exportExcel({ department_id: 1 })

      expect(result.data).toEqual(mockBlob)
      expect(mockApi.get).toHaveBeenCalledWith('/export/excel', {
        params: { department_id: 1 },
        responseType: 'blob'
      })
    })
  })

  describe('connectSSE', () => {
    it('should create SSE connection', () => {
      // Mock EventSource
      class MockEventSource {
        constructor(url) {
          this.url = url
          this.onmessage = null
          this.onerror = null
        }
        close() {}
      }

      global.EventSource = MockEventSource

      const onMessage = vi.fn()
      const onError = vi.fn()

      const source = api.connectSSE(onMessage, onError)

      expect(source).toBeInstanceOf(MockEventSource)
      expect(source.url).toBeTruthy()
    })

    it('should handle SSE messages', () => {
      let messageHandler = null

      class MockEventSource {
        constructor(url) {
          this.url = url
        }
        set onmessage(handler) {
          messageHandler = handler
        }
        close() {}
      }

      global.EventSource = MockEventSource

      const onMessage = vi.fn()
      api.connectSSE(onMessage)

      // Simulate incoming message
      messageHandler({ data: '{"type":"test","data":{}}' })

      expect(onMessage).toHaveBeenCalledWith({ type: 'test', data: {} })
    })
  })
})
