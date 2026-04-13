import { getInitials, getAvatarColor } from '../utils/helpers'

/**
 * Renders a circular avatar using the user's initials.
 * @param props.name - Full name to extract initials from.
 * @param props.color - Hex code or tailwind class for background color.
 * @param props.size - Determines the dimensions ('sm' or 'md').
 */
export function AvatarCircle({ name, color, size = 'sm' }: { name: string; color?: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-8 w-8 text-xs' : 'h-5 w-5 text-[9px]'
  const bgStyle = color ? { backgroundColor: color } : {}
  const bgClass = color ? '' : getAvatarColor(name)
  return (
    <div
      className={`${cls} ${bgClass} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={bgStyle}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
