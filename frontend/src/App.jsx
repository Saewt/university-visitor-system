import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import Admin from './pages/Admin'
import TeacherDashboard from './pages/Teacher'
import DayDashboard from './pages/DayDashboard'
import { getToken, getUser } from './services/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken())
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (isAuthenticated) {
      setUser(getUser())
    }
  }, [isAuthenticated])

  const getDefaultRoute = () => {
    if (!isAuthenticated) return '/login'
    if (user?.role === 'admin') return '/admin'
    return '/teacher'
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Ana içeriğe atla</a>
      <Routes>
      <Route path="/login" element={<Login onLogin={(u) => { setUser(u); setIsAuthenticated(true) }} />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/admin"
        element={
          isAuthenticated ? (
            user?.role === 'admin' ? (
              <Admin user={user} onLogout={() => { setIsAuthenticated(false); setUser(null) }} />
            ) : (
              <Navigate to="/teacher" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/teacher"
        element={
          isAuthenticated ? (
            user?.role === 'teacher' ? (
              <TeacherDashboard user={user} onLogout={() => { setIsAuthenticated(false); setUser(null) }} />
            ) : (
              <Navigate to="/admin" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/history/day/:date"
        element={
          isAuthenticated ? (
            user?.role === 'admin' ? (
              <DayDashboard user={user} onLogout={() => { setIsAuthenticated(false); setUser(null) }} />
            ) : (
              <Navigate to="/teacher" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
      }
      />
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
    </>
  )
}

export default App
