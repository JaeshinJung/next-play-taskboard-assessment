/**
 * Extracts initials from a full name (e.g., 'John Doe' -> 'JD').
 * @param name - The full name string.
 * @returns A two-letter uppercase string.
 */
export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Generates a stable, deterministic Tailwind background color class based on a name string.
 * @param name - The string to hash.
 * @returns A tailwind background color class.
 */
export function getAvatarColor(name: string): string {
  const colors = [
    'bg-violet-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500',
    'bg-cyan-500', 'bg-purple-500', 'bg-teal-500', 'bg-pink-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

/**
 * Evaluates whether a given task is considered overdue.
 * @param dueDate - The ISO-formatted due date string.
 * @param status - The current textual status of the task.
 * @returns true if the deadline is missed and the task is not done.
 */
export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'Done') return false
  const [y, m, d] = dueDate.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return false
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

/**
 * Formats an ISO date string into a clean, human-readable format (e.g., 'Oct 12').
 * @param dateStr - ISO-formatted date string.
 * @returns Localized shorthand text.
 */
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Formats a full ISO timestamp into a human-readable date and time.
 * @param ts - A complete ISO-formatted timestamp.
 * @returns Localized explicit string (date and time).
 */
export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
