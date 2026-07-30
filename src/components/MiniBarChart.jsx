const COLOR_CLASSES = {
  blue: 'bg-bb-blue',
  orange: 'bg-orange-400',
  green: 'bg-green-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
}

export default function MiniBarChart({ title, data }) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      {title && <h4 className="mb-2 text-xs font-semibold text-gray-700">{title}</h4>}
      {data.length === 0 && <p className="text-xs text-gray-400">Walang datos.</p>}
      <div className="space-y-1.5">
        {data.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-xs text-gray-500">{row.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${COLOR_CLASSES[row.color] ?? COLOR_CLASSES.blue}`}
                style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-xs font-semibold text-gray-700">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
