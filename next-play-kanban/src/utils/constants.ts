/**
 * Definition of the standard Kanban board columns.
 */
export const COLUMNS = [
  { id: 'To Do',       title: 'To Do' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'In Review',   title: 'In Review' },
  { id: 'Done',        title: 'Done' },
] as const

/**
 * Configuration mapping for priority visual states.
 * Defines background, text, and indicator dot colors.
 */
export const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  high:   { label: 'High',   bg: 'bg-red-50',   text: 'text-red-700',   dot: 'bg-red-500' },
  medium: { label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  low:    { label: 'Low',    bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-500' },
}
