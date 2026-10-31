const BASIC_COLORS = ['#2563eb', '#ea580c', '#16a34a', '#dc2626', '#9333ea', '#ca8a04', '#0891b2', '#db2777', '#78350f', '#475569', '#4338ca', '#4d7c0f']

// Allocate colors once from the full dataset, not the currently filtered subset.
export function incidentTypeColors(types) {
  return Object.fromEntries([...new Set(types)].sort((a,b) => a.localeCompare(b)).map((type,index) => [type,
    BASIC_COLORS[index] || `hsl(${(index * 137.508) % 360}, 70%, 45%)`,
  ]))
}
