import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminV1 from './AdminV1'

function Admin({ user, onLogout }) {
  const navigate = useNavigate()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { authAPI } = await import('../services/api')
        const userData = await authAPI.me()
      } catch (err) {
        navigate('/login')
      }
    }
    if (!user) {
      loadUser()
    }
  }, [user, navigate])

  return <AdminV1 user={user} onLogout={onLogout} />
}

export default Admin
