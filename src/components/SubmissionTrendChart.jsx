import { TrendingUp } from 'lucide-react'

export default function SubmissionTrendChart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value))
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="submission-trend-card">
      <div className="submission-trend-heading">
        <div>
          <h4>Mga Ulat na Isinumite</h4>
          <p>Huling 7 araw</p>
        </div>
        <span className="submission-trend-total"><TrendingUp size={13} /> {total} kabuuan</span>
      </div>

      <div className="submission-trend-plot" aria-label={`Kabuuang ${total} ulat na isinumite sa huling pitong araw`}>
        {data.map((item, index) => {
          const isToday = index === data.length - 1
          const height = item.value === 0 ? 0 : Math.max(24, (item.value / max) * 100)
          return (
            <div className={`submission-trend-column${isToday ? ' is-today' : ''}`} key={item.label}>
              <span className="submission-trend-value">{item.value}</span>
              <div className="submission-trend-track">
                <span className={`submission-trend-bar${item.value === 0 ? ' is-empty' : ''}`} style={{ height: `${height}%` }} />
              </div>
              <span className="submission-trend-label">{isToday ? 'Ngayon' : item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
