const VARIANTS = {
  orange: 'bg-amber-50 text-amber-700 border border-amber-200/70',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200/70',
  green: 'bg-[#eafaf1] text-[#057a55] border border-[#bbf7d0]/70',
  red: 'bg-red-50 text-red-700 border border-red-200/70',
  gray: 'bg-gray-100 text-gray-600 border border-gray-200/70',
}

const SOLID_VARIANTS = {
  orange: 'bg-amber-500 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-emerald-600 text-white',
  red: 'bg-red-500 text-white',
  gray: 'bg-gray-400 text-white',
}

export default function Pill({ children, color = 'gray', solid = false, icon: Icon, className = '' }) {
  const classes = solid ? SOLID_VARIANTS[color] : VARIANTS[color]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold whitespace-nowrap shadow-2xs ${classes} ${className}`}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}
