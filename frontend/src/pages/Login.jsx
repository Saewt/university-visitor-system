import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'

/**
 * Login Page - University Visitor Registration System
 * Modern, accessible login component with role-based routing
 */
function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleFocus = (field) => setFocusedField(field)
  const handleBlur = () => setFocusedField(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authAPI.login(formData.username, formData.password)
      onLogin(result.user)

      // Navigate based on role
      if (result.user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/teacher')
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.'
      )
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (username, password) => {
    setFormData({ username, password })
    setError('')
  }

  return (
    <div className="login-page" id="main-content">
      {/* Background Pattern */}
      <div className="login-bg-pattern">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floating Shapes */}
      <div className="login-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="login-container">
        {/* Left Panel - Branding */}
        <div className="login-brand">
          <div className="brand-logo">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="12" fill="rgba(255,255,255,0.2)" />
              <path d="M16 24L32 16L48 24V40L32 48L16 40V24Z" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M24 28L32 24L40 28V36L32 40L24 36V28Z" fill="white" />
            </svg>
          </div>

          <h1 className="brand-title">ACIBADEM</h1>
          <p className="brand-subtitle">ÜNİVERSİTESİ</p>

          <div className="brand-divider"></div>

          <div className="brand-description">
            <h2>Ziyaretçi Kayıt Sistemi</h2>
            <p>Üniversite Tanıtım Günü</p>
          </div>

          <div className="brand-features">
            <div className="feature-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span>Öğrenci Takibi</span>
            </div>
            <div className="feature-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Gerçek Zamanlı Kayıt</span>
            </div>
            <div className="feature-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.21 15.89A10 10 0 118 2.83" />
                <path d="M22 12A10 10 0 0012 2v10z" />
              </svg>
              <span>Detaylı Raporlama</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="login-form-wrapper">
          <div className="login-form-card">
            <div className="login-header">
              <h1>Giriş Yap</h1>
              <p>Yönetim paneline erişmek için giriş yapın</p>
            </div>

            {error && (
              <div className="login-alert login-alert-error">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              {/* Username Field */}
              <div className={`form-group ${focusedField === 'username' ? 'focused' : ''}`}>
                <label htmlFor="username" className="form-label">
                  Kullanıcı Adı
                </label>
                <div className="form-input-wrapper">
                  <svg className="form-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    onFocus={() => handleFocus('username')}
                    onBlur={handleBlur}
                    required
                    autoFocus
                    placeholder="Kullanıcı adı giriniz"
                    className="form-input"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className={`form-group ${focusedField === 'password' ? 'focused' : ''}`}>
                <label htmlFor="password" className="form-label">
                  Şifre
                </label>
                <div className="form-input-wrapper">
                  <svg className="form-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => handleFocus('password')}
                    onBlur={handleBlur}
                    required
                    placeholder="Şifrenizi giriniz"
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="form-input-toggle"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11a18.5 18.5 0 01-5.06 5.94M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4-8-11-8-11 8-11 8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-login"
              >
                {loading ? (
                  <>
                    <div className="btn-spinner"></div>
                    <span>Giriş yapılıyor...</span>
                  </>
                ) : (
                  <>
                    <span>Giriş Yap</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Demo Accounts */}
            <div className="login-demo">
              <div className="demo-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>Demo Hesaplar</span>
              </div>
              <div className="demo-buttons">
                <button
                  onClick={() => fillDemo('Özgür Güler', 'admin123')}
                  className="demo-btn demo-btn-admin"
                  type="button"
                >
                  <span className="demo-role">Admin</span>
                  <span className="demo-creds">Özgür Güler / admin123</span>
                </button>
                <button
                  onClick={() => fillDemo('Okan', 'teacher123')}
                  className="demo-btn demo-btn-teacher"
                  type="button"
                >
                  <span className="demo-role">Teacher</span>
                  <span className="demo-creds">Okan / teacher123</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="login-footer">
              <p>© 2026 Acıbadem Üniversitesi. Tüm hakları saklıdır.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
