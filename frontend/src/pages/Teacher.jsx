import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import TeacherV1 from './TeacherV1'

function Teacher({ user: initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser)
  const navigate = useNavigate()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await authAPI.getMe()
        setUser(userData)
      } catch (err) {
        navigate('/login')
      }
    }
    if (!initialUser) {
      loadUser()
    }
  }, [initialUser, navigate])

  return <TeacherV1 user={user} onLogout={onLogout} />
}

export default Teacher
