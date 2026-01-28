import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#366092', '#28a745', '#ffc107', '#17a2b8', '#dc3545', '#6f42c1', '#fd7e14', '#20c997']

function DepartmentChart({ byDepartment, byType }) {
  // Prepare data for bar chart
  const departmentData = byDepartment?.map(d => ({
    name: d.department_name.length > 15 ? d.department_name.substring(0, 15) + '...' : d.department_name,
    fullName: d.department_name,
    count: d.count
  })) || []

  // Prepare data for pie chart
  const typeMapping = {
    'SAYISAL': 'Sayısal',
    'SOZEL': 'Sözel',
    'EA': 'Eşit Ağırlık',
    'DIL': 'Dil'
  }

  const typeData = byType?.map((t, i) => ({
    name: typeMapping[t.yks_type] || t.yks_type,
    value: t.count,
    color: COLORS[i % COLORS.length]
  })) || []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
      {/* Department Bar Chart */}
      <div className="card">
        <div className="card-header">
          Bölüme Göre Dağılım
        </div>
        <div className="card-body">
          {departmentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{
                          backgroundColor: 'white',
                          padding: '10px',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          <p style={{ margin: 0 }}>{payload[0].payload.fullName}</p>
                          <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].value} öğrenci</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="count" fill="#366092" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted">Veri yok</p>
          )}
        </div>
      </div>

      {/* YKS Type Pie Chart */}
      <div className="card">
        <div className="card-header">
          YKS Türü Dağılımı
        </div>
        <div className="card-body">
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted">Veri yok</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DepartmentChart
