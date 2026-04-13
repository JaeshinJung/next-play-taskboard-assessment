import { useState } from 'react'
import { Users, X, UserPlus, UserMinus } from 'lucide-react'
import type { TeamMember } from '../types'
import { AvatarCircle } from './AvatarCircle'

/**
 * A dialog overlay for managing the global team roster.
 * Allows adding new members with randomized initial colors, or removing them.
 *
 * @param props.teamMembers - The active roster array.
 * @param props.onClose - Callback to dismiss the modal.
 * @param props.onAddMember - Callback containing the new member's name and auto-color.
 * @param props.onRemoveMember - Callback specifying the member ID to delete.
 */
export function TeamModal({
  teamMembers, onClose, onAddMember, onRemoveMember,
}: {
  teamMembers: TeamMember[]
  onClose: () => void
  onAddMember: (name: string, color: string) => Promise<void>
  onRemoveMember: (id: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')

  const handleAdd = async () => {
    if (!name.trim()) return
    await onAddMember(name.trim(), color)
    setName('')
    setColor('#6366f1')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-800">Team Members</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 rounded border-0 cursor-pointer bg-transparent p-0 shrink-0" />
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Member name…"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
            />
            <button onClick={handleAdd} disabled={!name.trim()} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
              <UserPlus className="h-3.5 w-3.5" /> Add
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {teamMembers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No team members yet</p>
            ) : (
              teamMembers.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 group">
                  <div className="flex items-center gap-2.5">
                    <AvatarCircle name={m.name} color={m.color} size="md" />
                    <span className="text-sm font-medium text-slate-700">{m.name}</span>
                  </div>
                  <button
                    onClick={() => onRemoveMember(m.id)}
                    className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
