export default function StatTile({ icon: Icon, label, value, accent = 'blue' }) {
  const accents = {
    blue: 'bg-bb-blue-light text-bb-blue',
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
  }

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accents[accent]}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}
