import { useState, useEffect } from 'react'
import { Loader2, Trash2, X, Palette, MessageSquare, Activity, Send, Clock } from 'lucide-react'
import type { Task, Label, Comment, ActivityLogEntry, TeamMember } from '../types'
import { COLUMNS } from '../utils/constants'
import { formatTimestamp } from '../utils/helpers'

/**
 * A slide-over panel displaying comprehensive details for a specific task.
 * Manages local state for editing modes and aggregates comments & activity logs.
 *
 * @param props.task - The active task data.
 * @param props.allLabels - Full inventory of labels available for assignment.
 * @param props.taskLabels - Labels currently assigned to this task.
 * @param props.comments - Array of user comments attached to the task.
 * @param props.activityLog - Audit trail of modifications to the task.
 * @param props.teamMembers - System roster for assigning users.
 * @param props.onClose - Callback to unmount the panel.
 * @param props.onUpdateTask - Callback fired when task metadata is altered.
 * @param props.onAddComment - Callback to append a new text comment.
 * @param props.onToggleLabel - Callback to attach or decouple a label.
 * @param props.onDeleteTask - Callback to immediately trash the task.
 * @param props.onCreateLabel - Callback for creating new global labels.
 * @param props.onDeleteLabel - Callback for removing global labels.
 */
export function TaskDetailPanel({
  task, allLabels, taskLabels, comments, activityLog, teamMembers,
  onClose, onUpdateTask, onAddComment, onToggleLabel, onDeleteTask, onCreateLabel, onDeleteLabel,
}: {
  task: Task
  allLabels: Label[]
  taskLabels: Label[]
  comments: Comment[]
  activityLog: ActivityLogEntry[]
  teamMembers: TeamMember[]
  onClose: () => void
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onAddComment: (taskId: string, text: string) => Promise<void>
  onToggleLabel: (taskId: string, labelId: string, assigned: boolean) => Promise<void>
  onDeleteTask: (taskId: string) => void
  onCreateLabel: (name: string, color: string) => Promise<void>
  onDeleteLabel: (id: string) => Promise<void>
}) {
  const [title, setTitle]             = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority]       = useState(task.priority ?? '')
  const [dueDate, setDueDate]         = useState(task.due_date?.split('T')[0] ?? '')
  const [commentText, setCommentText] = useState('')
  const [activeTab, setActiveTab]     = useState<'comments' | 'activity'>('comments')
  const [isSaving, setIsSaving]       = useState(false)
  const [newLabelName, setNewLabelName]   = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#6366f1')
  const [showLabelForm, setShowLabelForm] = useState(false)

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setPriority(task.priority ?? '')
    setDueDate(task.due_date?.split('T')[0] ?? '')
  }, [task])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const save = async (field: string, value: string | null) => {
    setIsSaving(true)
    await onUpdateTask(task.id, { [field]: value || null } as Partial<Task>)
    setIsSaving(false)
  }

  const handleAddComment = async () => {
    const text = commentText.trim()
    if (!text) return
    setCommentText('')
    await onAddComment(task.id, text)
  }

  const taskLabelIds = new Set(taskLabels.map(l => l.id))

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Task Details</span>
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onDeleteTask(task.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && save('title', title.trim())}
            className="w-full text-xl font-semibold text-slate-900 border-0 border-b-2 border-transparent focus:border-indigo-400 focus:outline-none pb-1 transition-colors bg-transparent"
            placeholder="Task title"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Status</label>
              <select
                value={task.status}
                onChange={(e) => onUpdateTask(task.id, { status: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
              >
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Priority</label>
              <select
                value={priority}
                onChange={(e) => { setPriority(e.target.value); save('priority', e.target.value || null) }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
              >
                <option value="">No priority</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🔵 Low</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); save('due_date', e.target.value || null) }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Assignee</label>
              <select
                value={task.assignee_name ?? ''}
                onChange={(e) => {
                  const selectedMember = teamMembers.find(m => m.name === e.target.value)
                  onUpdateTask(task.id, { assignee_name: selectedMember?.name || null })
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
              >
                <option value="">Unassigned</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Labels</label>
              <button
                onClick={() => setShowLabelForm(v => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Palette className="h-3 w-3" />
                {showLabelForm ? 'Cancel' : 'Manage'}
              </button>
            </div>

            {showLabelForm && (
              <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="h-8 w-8 rounded border-0 cursor-pointer bg-transparent p-0"
                />
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLabelName.trim()) {
                      onCreateLabel(newLabelName.trim(), newLabelColor)
                      setNewLabelName('')
                      setNewLabelColor('#6366f1')
                    }
                  }}
                  placeholder="Label name…"
                  className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={() => {
                    if (!newLabelName.trim()) return
                    onCreateLabel(newLabelName.trim(), newLabelColor)
                    setNewLabelName('')
                    setNewLabelColor('#6366f1')
                  }}
                  disabled={!newLabelName.trim()}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-1">
              {allLabels.map(label => {
                const on = taskLabelIds.has(label.id)
                return (
                  <div key={label.id} className="relative group flex items-center pr-1.5 pt-1.5">
                    <button
                      onClick={() => onToggleLabel(task.id, label.id, on)}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 border-2 ${
                        on ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                      style={on ? { backgroundColor: label.color, borderColor: label.color } : {}}
                    >
                      {label.name}
                    </button>
                    {showLabelForm && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Delete label "${label.name}"? This removes it from all tasks.`)) {
                            onDeleteLabel(label.id)
                          }
                        }}
                        className="absolute top-0 right-0 h-4 w-4 bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-slate-200 shadow-sm"
                        title="Delete Label"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                )
              })}
              {allLabels.length === 0 && !showLabelForm && <span className="text-xs text-slate-400">No labels — click Manage to create one</span>}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description.trim() !== (task.description ?? '') && save('description', description.trim() || null)}
              placeholder="Add a description…"
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 resize-y"
            />
          </div>

          <div>
            <div className="flex gap-1 border-b border-slate-200 mb-4">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'comments' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Comments ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'activity' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                <Activity className="h-3.5 w-3.5" /> Activity ({activityLog.length})
              </button>
            </div>

            {activeTab === 'comments' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Write a comment…"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {comments.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No comments yet. Start the conversation!</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm text-slate-700">{c.content}</p>
                      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTimestamp(c.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div>
                {activityLog.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-1">
                    {activityLog.map(entry => (
                      <div key={entry.id} className="flex items-start gap-2.5 py-2">
                        <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                          <Activity className="h-3 w-3 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-700">{entry.action}</p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" /> {formatTimestamp(entry.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
