/**
 * Offline Storage Service using IndexedDB
 * Stores student data locally when network is unavailable
 */

const DB_NAME = 'UniversityVisitorsDB'
const DB_VERSION = 1
const STORE_NAME = 'pending_students'

// Open IndexedDB
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('created_at', 'created_at', { unique: false })
      }
    }
  })
}

/**
 * Add a student to offline storage
 */
export const addOfflineStudent = async (studentData) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const record = {
      studentData,
      created_at: new Date().toISOString(),
      synced: false
    }

    return new Promise((resolve, reject) => {
      const request = store.add(record)

      request.onsuccess = () => {
        db.close()
        resolve(request.result)  // Return the generated ID
      }

      request.onerror = () => {
        db.close()
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('Error adding offline student:', error)
    throw error
  }
}

/**
 * Get all pending (unsynced) students
 */
export const getPendingStudents = async () => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('created_at')

    const records = await new Promise((resolve, reject) => {
      const request = index.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    await db.close()
    return records
  } catch (error) {
    console.error('Error getting pending students:', error)
    return []
  }
}

/**
 * Get count of pending students
 */
export const getPendingCount = async () => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    const count = await new Promise((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    await db.close()
    return count
  } catch (error) {
    console.error('Error getting pending count:', error)
    return 0
  }
}

/**
 * Delete a record from offline storage (after successful sync)
 */
export const deleteOfflineStudent = async (id) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    await db.close()
  } catch (error) {
    console.error('Error deleting offline student:', error)
  }
}

/**
 * Clear all pending students (use with caution)
 */
export const clearAllPending = async () => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    await db.close()
  } catch (error) {
    console.error('Error clearing pending students:', error)
  }
}
