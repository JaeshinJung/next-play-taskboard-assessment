import { PRIORITY_CONFIG } from '../utils/constants'

/**
 * Renders a priority indicator with dynamic coloring based on importance.
 * @param props.priority - The semantic priority string (e.g. 'high').
 */
export function PriorityBadge({ priority }: { priority: string }) {
  const c = PRIORITY_CONFIG[priority]
  if (!c) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
