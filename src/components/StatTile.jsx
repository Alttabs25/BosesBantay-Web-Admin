export default function StatTile({ icon: Icon, label, value, accent = 'blue', onClick, selected, interactive }) {
  const accents = {
    blue: 'bg-bb-blue-light text-bb-blue',
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
  }

  const borderAccents = {
    blue: 'border-bb-blue ring-1 ring-bb-blue',
    orange: 'border-orange-500 ring-1 ring-orange-500',
    green: 'border-green-500 ring-1 ring-green-500',
    red: 'border-red-500 ring-1 ring-red-500',
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-3 select-none transition-all ${
        interactive ? 'cursor-pointer hover:shadow-sm' : ''
      } ${
        selected
          ? `${borderAccents[accent]} bg-gray-50/50`
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
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
