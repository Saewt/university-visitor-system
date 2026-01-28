import { useState, useEffect } from 'react'
import { studentsAPI } from '../services/api'

function StudentForm({ onSuccess, onCancel }) {
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        ...formData,
        ranking: formData.ranking ? parseInt(formData.ranking) : null,
        yks_score: formData.yks_score ? parseFloat(formData.yks_score) : null,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
      }

      await studentsAPI.create(payload)
      if (onSuccess) onSuccess()
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

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Yeni Öğrenci Kaydı</h3>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-danger">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label required" htmlFor="first_name">Ad</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  className="form-control"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="last_name">Soyad</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  className="form-control"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">E-posta</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-control"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">Telefon</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="form-control"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="high_school">Lise</label>
              <input
                type="text"
                id="high_school"
                name="high_school"
                className="form-control"
                value={formData.high_school}
                onChange={handleChange}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="ranking">Sıralama</label>
                <input
                  type="number"
                  id="ranking"
                  name="ranking"
                  className="form-control"
                  value={formData.ranking}
                  onChange={handleChange}
                  min="1"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="yks_score">YKS Puanı</label>
                <input
                  type="number"
                  id="yks_score"
                  name="yks_score"
                  className="form-control"
                  value={formData.yks_score}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  max="600"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="yks_type">YKS Türü</label>
                <select
                  id="yks_type"
                  name="yks_type"
                  className="form-control"
                  value={formData.yks_type}
                  onChange={handleChange}
                >
                  <option value="">Seçiniz</option>
                  <option value="SAYISAL">Sayısal</option>
                  <option value="SOZEL">Sözel</option>
                  <option value="EA">Eşit Ağırlık</option>
                  <option value="DIL">Dil</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="department_id">İlgi Alanı / Bölüm</label>
              <select
                id="department_id"
                name="department_id"
                className="form-control"
                value={formData.department_id}
                onChange={handleChange}
              >
                <option value="">Seçiniz</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="form-check">
              <input
                type="checkbox"
                id="wants_tour"
                name="wants_tour"
                className="form-check-input"
                checked={formData.wants_tour}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="wants_tour">
                Okul Turu İsteği: Evet
              </label>
            </div>

            <div className="d-flex justify-between mt-4">
              <button type="button" className="btn btn-outline" onClick={onCancel}>
                İptal
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default StudentForm
