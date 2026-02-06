/**
 * Offline Sync Service
 * Handles network status detection and syncing offline data
 *
 * IMPROVED: More robust offline detection, proper timeout handling,
 * conservative offline triggering to avoid false positives
 */

import * as offlineStorage from './offlineStorage'
import { API_BASE_URL } from './api'

let isOnline = navigator.onLine
let syncInProgress = false
let listeners = []
let connectivityCheckInterval = null
let consecutiveFailures = 0
const MAX_CONSECUTIVE_FAILURES = 3  // Only mark offline after 3 consecutive failures

/**
 * Notify all listeners of status change
 */
const notifyListeners = () => {
  listeners.forEach(listener => listener(isOnline))
}

/**
 * Perform a health check with proper timeout
 */
const checkServerHealth = async () => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      // Verify we got valid JSON with status
      return data && (data.status === 'ok' || data.status === 'healthy')
    }
    return false
  } catch (error) {
    clearTimeout(timeoutId)
    // Only treat as offline if it's a network-related error
    if (error.name === 'AbortError') {
      console.log('Health check timeout')
      return false
    }
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      console.log('Network error during health check:', error.message)
      return false
    }
    // For other errors, assume we're still online (could be a server error)
    return true
  }
}

/**
 * Initialize network status monitoring
 */
export const initNetworkMonitor = () => {
  // Set initial state
  isOnline = navigator.onLine
  consecutiveFailures = 0
  notifyListeners()

  // Listen for browser online/offline events
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Start health check polling (every 15 seconds instead of 30)
  startConnectivityCheck()

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (connectivityCheckInterval) {
      clearInterval(connectivityCheckInterval)
    }
  }
}

const handleOnline = async () => {
  console.log('Browser detected online event')
  consecutiveFailures = 0
  isOnline = true
  notifyListeners()
  await syncPendingData()
}

const handleOffline = () => {
  console.log('Browser detected offline event')
  consecutiveFailures = MAX_CONSECUTIVE_FAILURES
  isOnline = false
  notifyListeners()
}

/**
 * Check connectivity by pinging the server
 * Only marks offline after multiple consecutive failures
 */
const startConnectivityCheck = () => {
  // Clear any existing interval
  if (connectivityCheckInterval) {
    clearInterval(connectivityCheckInterval)
  }

  // Check every 15 seconds
  connectivityCheckInterval = setInterval(async () => {
    try {
      const isServerUp = await checkServerHealth()

      if (isServerUp) {
        // Server is responding
        if (!isOnline) {
          console.log('Server connection restored')
          consecutiveFailures = 0
          isOnline = true
          notifyListeners()
          await syncPendingData()
        } else {
          // Reset failure count on success
          consecutiveFailures = 0
        }
      } else {
        // Server didn't respond
        consecutiveFailures++
        console.log(`Health check failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`)

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && isOnline) {
          console.log('Marking as offline after multiple failures')
          isOnline = false
          notifyListeners()
        }
      }
    } catch (error) {
      console.error('Health check error:', error)
      consecutiveFailures++
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && isOnline) {
        isOnline = false
        notifyListeners()
      }
    }
  }, 15000) // 15 seconds
}

/**
 * Subscribe to network status changes
 */
export const subscribeToNetworkStatus = (callback) => {
  listeners.push(callback)
  // Immediately call with current status
  callback(isOnline)
  return () => {
    listeners = listeners.filter(cb => cb !== callback)
  }
}

/**
 * Get current online status
 */
export const getOnlineStatus = () => isOnline

/**
 * Sync all pending students to the backend
 */
export const syncPendingData = async () => {
  if (syncInProgress || !isOnline) {
    return { success: 0, failed: 0 }
  }

  syncInProgress = true

  try {
    const pendingStudents = await offlineStorage.getPendingStudents()

    if (pendingStudents.length === 0) {
      return { success: 0, failed: 0 }
    }

    console.log(`Syncing ${pendingStudents.length} pending students...`)

    // Dynamically import studentsAPI to avoid circular dependencies
    const { studentsAPI } = await import('./api')

    let successCount = 0
    let failedCount = 0

    for (const record of pendingStudents) {
      try {
        await studentsAPI.create(record.studentData)
        await offlineStorage.deleteOfflineStudent(record.id)
        successCount++
      } catch (error) {
        console.error('Failed to sync student:', error)
        failedCount++
      }
    }

    if (successCount > 0) {
      console.log(`Synced ${successCount} students successfully`)
      // Only reload if we have actual data to sync
      window.location.reload()
    }

    return { success: successCount, failed: failedCount }
  } catch (error) {
    console.error('Error during sync:', error)
    return { success: 0, failed: 0 }
  } finally {
    syncInProgress = false
  }
}

/**
 * Check if sync is currently in progress
 */
export const isSyncInProgress = () => syncInProgress

/**
 * Manual trigger sync (for sync button)
 */
export const triggerSync = async () => {
  if (!isOnline) {
    return { success: 0, failed: 0, error: 'Offline' }
  }
  return await syncPendingData()
}

/**
 * Enhanced API wrapper that handles offline mode
 * More conservative about marking things as offline
 */
export const safeAPICall = async (apiCall, data) => {
  if (isOnline) {
    try {
      const result = await apiCall(data)
      // Reset failure count on successful call
      consecutiveFailures = 0
      return result
    } catch (error) {
      // Check if it's genuinely a network error
      const isNetworkError = (
        !navigator.onLine ||
        error.code === 'ERR_NETWORK' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('Network Error') ||
        error.message?.includes('ECONNREFUSED')
      )

      if (isNetworkError) {
        console.log('Network error detected, storing offline')
        isOnline = false
        notifyListeners()

        // Store data offline
        const id = await offlineStorage.addOfflineStudent(data)
        return { offline: true, id }
      }
      throw error
    }
  } else {
    // Store offline immediately
    const id = await offlineStorage.addOfflineStudent(data)
    return { offline: true, id }
  }
}
