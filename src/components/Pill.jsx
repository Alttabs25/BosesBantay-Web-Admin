const VARIANTS = {
  orange: 'bg-orange-100 text-orange-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
}

const SOLID_VARIANTS = {
  orange: 'bg-orange-400 text-white',
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  red: 'bg-red-500 text-white',
  gray: 'bg-gray-400 text-white',
}

export default function Pill({ children, color = 'gray', solid = false, icon: Icon }) {
  const classes = solid ? SOLID_VARIANTS[color] : VARIANTS[color]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${classes}`}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}
