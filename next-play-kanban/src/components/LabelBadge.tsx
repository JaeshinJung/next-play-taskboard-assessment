import type { Label } from '../types'

/**
 * Renders a customized visual label pill.
 * @param props.label - The Label object containing name and color metadata.
 */
export function LabelBadge({ label }: { label: Label }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: label.color }}
    >
      {label.name}
    </span>
  )
}
