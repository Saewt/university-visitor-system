function StatsCards({ summary }) {
  if (!summary) return null

  const cards = [
    {
      label: 'Toplam Öğrenci',
      value: summary.total_students,
      type: 'primary'
    },
    {
      label: 'Bugünkü Kayıtlar',
      value: summary.today_count,
      type: 'success'
    },
    {
      label: 'Tur İsteği',
      value: summary.tour_requests,
      type: 'warning'
    },
    {
      label: 'Bölüm Sayısı',
      value: summary.unique_departments,
      type: 'info'
    },
  ]

  return (
    <div className="stats-grid">
      {cards.map((card, index) => (
        <div key={index} className={`stat-card ${card.type}`}>
          <div className="stat-label">{card.label}</div>
          <div className="stat-value">{card.value}</div>
        </div>
      ))}
    </div>
  )
}

export default StatsCards
