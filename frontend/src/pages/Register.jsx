import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { studentsAPI } from '../services/api'

function Register({ onSuccess }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    high_school: '',
    ranking: '',
    yks_score: '',
    yks_type: '',
    department_id: '',
    wants_tour: false,
  })
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  // Ref to store timeout ID for cleanup
  const debounceTimeoutRef = useRef(null)

  const navigate = useNavigate()

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const data = await studentsAPI.getDepartments()
        setDepartments(data)
      } catch (e) {
        console.error('Failed to load departments:', e)
      }
    }
    loadDepartments()

    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Check for duplicates when email or phone changes
  const checkDuplicates = useCallback(async (email, phone) => {
    if (!email && !phone) {
      setDuplicateWarning(null)
      return
    }

    setCheckingDuplicate(true)
    try {
      const result = await studentsAPI.checkDuplicate(email, phone)
      if (result.has_duplicates) {
        setDuplicateWarning(result)
      } else {
        setDuplicateWarning(null)
      }
    } catch (err) {
      // Silently fail - duplicate check is nice to have
      console.error('Duplicate check failed:', err)
    } finally {
      setCheckingDuplicate(false)
    }
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))
    setError('')

    // Check duplicates when email or phone changes
    if (name === 'email' || name === 'phone') {
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      const email = name === 'email' ? newValue : formData.email
      const phone = name === 'phone' ? newValue : formData.phone

      // Debounce duplicate check
      debounceTimeoutRef.current = setTimeout(() => {
        checkDuplicates(email, phone)
      }, 500)
    }
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      high_school: '',
      ranking: '',
      yks_score: '',
      yks_type: '',
      department_id: '',
      wants_tour: false,
    })
    setDuplicateWarning(null)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // If there's a duplicate warning, confirm before proceeding
    if (duplicateWarning && duplicateWarning.has_duplicates) {
      if (!confirm('Bu öğrenci benzer bilgilerle kayıtlı. Yine de kaydetmek istiyor musunuz?')) {
        return
      }
    }

    setLoading(true)

    try {
      const payload = {
        ...formData,
        ranking: formData.ranking ? parseInt(formData.ranking) : null,
        yks_score: formData.yks_score ? parseFloat(formData.yks_score) : null,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
      }

      await studentsAPI.create(payload)

      // Instant reset on success
      resetForm()
      setSuccess(true)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const errors = err.response?.data?.detail
      if (Array.isArray(errors)) {
        setError(errors.map(e => e.msg).join(', '))
      } else {
        setError(err.response?.data?.detail || 'Kayıt başarısız.')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }} id="main-content">
      {/* Header */}
      <nav style={{
        background: '#366092',
        color: 'white',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🎓</span>
          <span style={{ fontSize: '18px', fontWeight: '600' }}>Üniversite Tanıtım Günü</span>
        </div>
        <Link
          to="/login"
          style={{
            color: 'white',
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            background: 'rgba(255,255,255,0.1)'
          }}
        >
          Giriş Yap
        </Link>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          padding: '32px'
        }}>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>
              Yeni Öğrenci Kaydı
            </h1>
            <p style={{ color: '#666', fontSize: '15px' }}>
              Lütfen öğrenci bilgilerini doldurunuz
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#c33',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {duplicateWarning && duplicateWarning.has_duplicates && (
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#92400E',
              fontSize: '14px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚠️ Benzer kayıt bulundu!
              </div>
              <div style={{ fontSize: '13px' }}>
                {duplicateWarning.duplicates.map(d => (
                  <div key={d.id} style={{ padding: '2px 0' }}>
                    • {d.name} - {d.department || 'Bölüm belirtilmemiş'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {success && (
            <div style={{
              background: '#e6f4ea',
              border: '1px solid #b7e1cd',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#1e7e34',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>✓</span>
              Öğrenci başarıyla kaydedildi!
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Name Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Ad <span style={{ color: '#c33' }}>*</span></label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  placeholder="Ahmet"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Soyad <span style={{ color: '#c33' }}>*</span></label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  placeholder="Yılmaz"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Contact Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>E-posta</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ornek@email.com"
                  style={{
                    ...inputStyle,
                    borderColor: duplicateWarning?.has_duplicates ? '#F59E0B' : inputStyle.border
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="0555 123 4567"
                  style={{
                    ...inputStyle,
                    borderColor: duplicateWarning?.has_duplicates ? '#F59E0B' : inputStyle.border
                  }}
                />
              </div>
            </div>

            {/* School */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Lise</label>
              <input
                type="text"
                name="high_school"
                value={formData.high_school}
                onChange={handleChange}
                placeholder="Mezun olunan lise"
                style={inputStyle}
              />
            </div>

            {/* YKS Info Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Sıralama</label>
                <input
                  type="number"
                  name="ranking"
                  value={formData.ranking}
                  onChange={handleChange}
                  placeholder="1000"
                  min="1"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>YKS Puanı</label>
                <input
                  type="number"
                  name="yks_score"
                  value={formData.yks_score}
                  onChange={handleChange}
                  placeholder="400"
                  step="0.01"
                  min="0"
                  max="600"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>YKS Türü</label>
                <select
                  name="yks_type"
                  value={formData.yks_type}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Seçiniz</option>
                  <option value="SAYISAL">Sayısal</option>
                  <option value="SOZEL">Sözel</option>
                  <option value="EA">Eşit Ağırlık</option>
                  <option value="DIL">Dil</option>
                </select>
              </div>
            </div>

            {/* Department */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>İlgi Alanı / Bölüm</label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Seçiniz</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Tour Request - Prominent */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              cursor: 'pointer',
              border: formData.wants_tour ? '2px solid #366092' : '2px solid transparent',
              transition: 'all 0.2s'
            }}>
              <input
                type="checkbox"
                name="wants_tour"
                checked={formData.wants_tour}
                onChange={handleChange}
                style={{ width: '20px', height: '20px' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: '#333', fontSize: '15px' }}>
                  🏛️ Okul Turu İsteği
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                  Öğrenci okul turu katılmak istiyor
                </div>
              </div>
            </label>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: loading ? '#999' : '#666',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Temizle
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'white',
                  background: loading ? '#999' : '#366092',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '50%',
                      borderTopColor: 'white',
                      animation: 'spin 0.8s linear infinite'
                    }}></span>
                    Kaydediliyor...
                  </>
                ) : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register
