import { Search, BarChart3, CheckCircle2, AlertCircle, Filter } from 'lucide-react'
import type { Label, TeamMember } from '../types'
import { AvatarCircle } from './AvatarCircle'

/**
 * Provides a top-level filtering interface and statistical summary.
 * Allows users to filter tasks by search term, assigned labels, and view total counts.
 * 
 * @param props.searchTerm - Current string for title filtering.
 * @param props.onSearchChange - Callback dispatched on input changes.
 * @param props.allLabels - Array of all selectable labels.
 * @param props.selectedLabelId - Currently active filter label ID.
 * @param props.onSelectLabel - Callback to update the active label filter.
 * @param props.teamMembers - Avatars rendered for aesthetics and summary.
 * @param props.totalTasks - Total aggregate of unhidden tasks.
 * @param props.completedTasks - Total tasks residing in 'Done' status.
 * @param props.overdueTasks - Total tasks with missed deadlines.
 */
export function SearchSummaryBar({
  searchTerm, onSearchChange,
  allLabels, selectedLabelId, onSelectLabel,
  teamMembers,
  totalTasks, completedTasks, overdueTasks,
}: {
  searchTerm: string
  onSearchChange: (v: string) => void
  allLabels: Label[]
  selectedLabelId: string | null
  onSelectLabel: (id: string | null) => void
  teamMembers: TeamMember[]
  totalTasks: number
  completedTasks: number
  overdueTasks: number
}) {
  return (
    <div className="bg-white border-b border-slate-200/60 px-8 py-3">
      <div className="max-w-[1440px] mx-auto space-y-3">
        <div className="flex items-center justify-between gap-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by title…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
            />
          </div>

          {teamMembers.length > 0 && (
            <div className="flex items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">Team</span>
              <div className="flex -space-x-1.5">
                {teamMembers.slice(0, 8).map(m => (
                  <AvatarCircle key={m.id} name={m.name} color={m.color} size="sm" />
                ))}
                {teamMembers.length > 8 && (
                  <div className="h-5 w-5 rounded-full bg-slate-300 flex items-center justify-center text-[8px] font-bold text-white">+{teamMembers.length - 8}</div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-600">{totalTasks} Total</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">{completedTasks} Done</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-700">{overdueTasks} Overdue</span>
            </div>
          </div>
        </div>

        {allLabels.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <button
              onClick={() => onSelectLabel(null)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 border ${
                selectedLabelId === null
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              All
            </button>
            {allLabels.map(label => (
              <button
                key={label.id}
                onClick={() => onSelectLabel(selectedLabelId === label.id ? null : label.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 border ${
                  selectedLabelId === label.id
                    ? 'text-white border-transparent'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                style={selectedLabelId === label.id ? { backgroundColor: label.color, borderColor: label.color } : {}}
              >
                {label.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
