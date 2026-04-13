import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import {
  GripVertical, Plus, Loader2, Layout, Inbox, Trash2, X,
  Search, CalendarDays, MessageSquare, Activity,
  Send, Clock, AlertCircle, CheckCircle2, BarChart3, Palette, Filter,
  Users, UserPlus, UserMinus,
} from 'lucide-react'
import { supabase } from './supabase'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Task {
  id: string
  title: string
  status: string
  user_id: string
  description: string | null
  priority: 'high' | 'medium' | 'low' | null
  assignee_name: string | null
  due_date: string | null
}

interface Comment {
  id: string
  task_id: string
  content: string
  created_at: string
}

interface ActivityLogEntry {
  id: string
  task_id: string
  action: string
  details: string | null
  created_at: string
}

interface Label {
  id: string
  name: string
  color: string
}

interface TeamMember {
  id: string
  name: string
  color: string
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const COLUMNS = [
  { id: 'To Do',       title: 'To Do' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'In Review',   title: 'In Review' },
  { id: 'Done',        title: 'Done' },
] as const

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  high:   { label: 'High',   bg: 'bg-red-50',   text: 'text-red-700',   dot: 'bg-red-500' },
  medium: { label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  low:    { label: 'Low',    bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-500' },
}

/* ================================================================== */
/*  Utilities                                                          */
/* ================================================================== */

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-violet-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500',
    'bg-cyan-500', 'bg-purple-500', 'bg-teal-500', 'bg-pink-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'Done') return false
  // Strip ISO time portion, then parse as local midnight
  const [y, m, d] = dueDate.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return false
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function formatDate(dateStr: string): string {
  // Strip ISO time portion, then parse as local date
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/* ================================================================== */
/*  Sub-Components                                                     */
/* ================================================================== */

/* ---- Priority Badge ---- */
function PriorityBadge({ priority }: { priority: string }) {
  const c = PRIORITY_CONFIG[priority]
  if (!c) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

/* ---- Avatar Circle ---- */
function AvatarCircle({ name, color, size = 'sm' }: { name: string; color?: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-8 w-8 text-xs' : 'h-5 w-5 text-[9px]'
  // Use explicit color (from team_members) or fallback to hash-based
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

/* ---- Label Badge ---- */
function LabelBadge({ label }: { label: Label }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: label.color }}
    >
      {label.name}
    </span>
  )
}

/* ---- Team Management Modal ---- */
function TeamModal({
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
          {/* Add member form */}
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

          {/* Members list */}
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

/* ---- Search & Summary Bar ---- */
function SearchSummaryBar({
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
        {/* Row 1: Search + Team Avatars + Stats */}
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

          {/* Team Avatars */}
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

        {/* Row 2: Label Filter Pills */}
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

/* ---- Task Detail Panel (Slide-over) ---- */
function TaskDetailPanel({
  task, allLabels, taskLabels, comments, activityLog, teamMembers,
  onClose, onUpdateTask, onAddComment, onToggleLabel, onDeleteTask, onCreateLabel,
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

  // Sync when the underlying task changes (optimistic updates from board)
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setPriority(task.priority ?? '')
    setDueDate(task.due_date?.split('T')[0] ?? '')
  }, [task])

  // Close on Escape
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && save('title', title.trim())}
            className="w-full text-xl font-semibold text-slate-900 border-0 border-b-2 border-transparent focus:border-indigo-400 focus:outline-none pb-1 transition-colors bg-transparent"
            placeholder="Task title"
          />

          {/* Attributes 2×2 grid */}
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

          {/* Labels */}
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

            {/* Create label form */}
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

            <div className="flex flex-wrap gap-2">
              {allLabels.map(label => {
                const on = taskLabelIds.has(label.id)
                return (
                  <button
                    key={label.id}
                    onClick={() => onToggleLabel(task.id, label.id, on)}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 border-2 ${
                      on ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                    style={on ? { backgroundColor: label.color, borderColor: label.color } : {}}
                  >
                    {label.name}
                  </button>
                )
              })}
              {allLabels.length === 0 && !showLabelForm && <span className="text-xs text-slate-400">No labels — click Manage to create one</span>}
            </div>
          </div>

          {/* Description */}
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

          {/* Tabs: Comments / Activity */}
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
                {/* Add comment */}
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

/* ================================================================== */
/*  Main App                                                           */
/* ================================================================== */

export default function App() {
  const [tasks, setTasks]                 = useState<Task[]>([])
  const [allLabels, setAllLabels]         = useState<Label[]>([])
  const [taskLabelsMap, setTaskLabelsMap] = useState<Record<string, Label[]>>({})
  const [teamMembers, setTeamMembers]     = useState<TeamMember[]>([])
  const [userId, setUserId]               = useState<string | null>(null)
  const [isLoading, setIsLoading]         = useState(true)
  const [isAdding, setIsAdding]           = useState(false)
  const [newTaskTitle, setNewTaskTitle]   = useState('')
  const [searchTerm, setSearchTerm]       = useState('')
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)

  // Detail panel
  const [selectedTaskId, setSelectedTaskId]   = useState<string | null>(null)
  const [detailComments, setDetailComments]   = useState<Comment[]>([])
  const [detailActivity, setDetailActivity]   = useState<ActivityLogEntry[]>([])

  /* -------- Derived -------- */

  const selectedTask = useMemo(() =>
    tasks.find(t => t.id === selectedTaskId) ?? null
  , [tasks, selectedTaskId])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Title filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        if (!t.title.toLowerCase().includes(q)) return false
      }
      // Label filter
      if (selectedLabelId) {
        const labels = taskLabelsMap[t.id] ?? []
        if (!labels.some(l => l.id === selectedLabelId)) return false
      }
      return true
    })
  }, [tasks, searchTerm, selectedLabelId, taskLabelsMap])

  const completedCount = useMemo(() => filteredTasks.filter(t => t.status === 'Done').length, [filteredTasks])
  const overdueCount   = useMemo(() => filteredTasks.filter(t => isOverdue(t.due_date, t.status)).length, [filteredTasks])

  /* -------- Bootstrap -------- */

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let user = session?.user
        if (!user) {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          user = data.user
        }
        if (user) {
          setUserId(user.id)
          await Promise.all([
            fetchTasks(user.id),
            fetchLabels(),
            fetchAllTaskLabels(),
            fetchTeamMembers(),
          ])
        }
      } catch (err) {
        console.error('Init failed:', err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  /* -------- Data Fetching -------- */

  const fetchTasks = async (uid: string) => {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', uid).order('id', { ascending: true })
    if (error) { console.error('Fetch tasks:', error); return }
    setTasks((data ?? []) as Task[])
  }

  const fetchLabels = async () => {
    const { data, error } = await supabase.from('labels').select('*').order('name', { ascending: true })
    if (error) { console.error('Fetch labels:', error); return }
    setAllLabels((data ?? []) as Label[])
  }

  const fetchAllTaskLabels = async () => {
    const { data, error } = await supabase.from('task_labels').select('task_id, label_id, labels(id, name, color)')
    if (error) { console.error('Fetch task_labels:', error); return }
    const map: Record<string, Label[]> = {}
    for (const row of (data ?? []) as any[]) {
      const tid = row.task_id as string
      if (!map[tid]) map[tid] = []
      if (row.labels) map[tid].push(row.labels as Label)
    }
    setTaskLabelsMap(map)
  }

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase.from('team_members').select('*').order('name', { ascending: true })
    if (error) { console.error('Fetch team_members:', error); return }
    setTeamMembers((data ?? []) as TeamMember[])
  }

  const addTeamMember = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase.from('team_members').insert([{ name, color }]).select()
    if (error) { console.error('Add team member:', error); return }
    if (data && data.length > 0) setTeamMembers(prev => [...prev, data[0] as TeamMember])
  }, [])

  const removeTeamMember = useCallback(async (id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id))
    const { error } = await supabase.from('team_members').delete().eq('id', id)
    if (error) { console.error('Remove team member:', error); fetchTeamMembers() }
  }, [])

  const fetchTaskDetail = async (taskId: string) => {
    const [commentsRes, activityRes] = await Promise.all([
      supabase.from('comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase.from('activity_log').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
    ])
    setDetailComments((commentsRes.data ?? []) as Comment[])
    setDetailActivity((activityRes.data ?? []) as ActivityLogEntry[])
  }

  /* -------- CRUD: Add Task -------- */

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTaskTitle.trim()
    if (!title || !userId) return

    setIsAdding(true)
    const { data, error } = await supabase.from('tasks').insert([{ title, status: 'To Do', user_id: userId }]).select()
    if (error) { console.error('Add task:', error) }
    else if (data && data.length > 0) {
      setTasks(prev => [...prev, data[0] as Task])
      setNewTaskTitle('')
    }
    setIsAdding(false)
  }

  /* -------- CRUD: Delete Task -------- */

  const deleteTask = useCallback(async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    if (selectedTaskId === taskId) setSelectedTaskId(null)
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) { console.error('Delete:', error); if (userId) fetchTasks(userId) }
  }, [selectedTaskId, userId])

  /* -------- CRUD: Update Task -------- */

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))

    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (error) { console.error('Update:', error); if (userId) fetchTasks(userId); return }

    // Log activity for notable changes
    const logs: string[] = []
    if (updates.status)        logs.push(`Status changed to "${updates.status}"`)
    if (updates.priority)      logs.push(`Priority set to "${updates.priority}"`)
    if (updates.title)         logs.push('Title updated')
    if (updates.assignee_name !== undefined) logs.push(updates.assignee_name ? `Assigned to "${updates.assignee_name}"` : 'Unassigned')
    if (updates.due_date !== undefined) logs.push(updates.due_date ? `Due date set to ${formatDate(updates.due_date)}` : 'Due date removed')

    for (const action of logs) {
      await supabase.from('activity_log').insert([{ task_id: taskId, action, details: '' }])
    }
    if (selectedTaskId === taskId && logs.length > 0) fetchTaskDetail(taskId)
  }, [userId, selectedTaskId])

  /* -------- CRUD: Comments -------- */

  const addComment = useCallback(async (taskId: string, text: string) => {
    const { data, error } = await supabase.from('comments').insert([{ task_id: taskId, content: text, user_id: userId }]).select()
    if (error) { console.error('Add comment:', error); return }
    if (data && data.length > 0) setDetailComments(prev => [...prev, data[0] as Comment])

    // Log
    await supabase.from('activity_log').insert([{ task_id: taskId, action: 'Comment added', details: '' }])
    if (selectedTaskId === taskId) {
      const { data: a } = await supabase.from('activity_log').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
      setDetailActivity((a ?? []) as ActivityLogEntry[])
    }
  }, [selectedTaskId, userId])

  /* -------- CRUD: Labels -------- */

  const toggleLabel = useCallback(async (taskId: string, labelId: string, isAssigned: boolean) => {
    if (isAssigned) {
      setTaskLabelsMap(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(l => l.id !== labelId) }))
      await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId)
    } else {
      const label = allLabels.find(l => l.id === labelId)
      if (label) setTaskLabelsMap(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), label] }))
      await supabase.from('task_labels').insert([{ task_id: taskId, label_id: labelId }])
    }
  }, [allLabels])

  /* -------- CRUD: Create Label -------- */

  const createLabel = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase.from('labels').insert([{ name, color }]).select()
    if (error) { console.error('Create label:', error); return }
    if (data && data.length > 0) {
      setAllLabels(prev => [...prev, data[0] as Label])
    }
  }, [])

  /* -------- Drag & Drop -------- */

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const newStatus = destination.droppableId

    setTasks(prev => {
      const copy = [...prev]
      const idx = copy.findIndex(t => t.id === draggableId)
      if (idx === -1) return prev
      const [moved] = copy.splice(idx, 1)
      moved.status = newStatus
      const destTasks = copy.filter(t => t.status === newStatus)
      const otherTasks = copy.filter(t => t.status !== newStatus)
      destTasks.splice(destination.index, 0, moved)
      return [...otherTasks, ...destTasks]
    })

    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', draggableId)
    if (error) { console.error('DnD:', error); if (userId) fetchTasks(userId); return }
    await supabase.from('activity_log').insert([{ task_id: draggableId, action: `Status changed to "${newStatus}"`, details: '' }])
  }

  /* -------- Open Detail Panel -------- */

  const openDetail = useCallback(async (taskId: string) => {
    setSelectedTaskId(taskId)
    await fetchTaskDetail(taskId)
  }, [])

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-['Inter',ui-sans-serif,system-ui,sans-serif] antialiased">

      {/* ──── Header ──── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Layout className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight leading-none">Project Tasks</h1>
              <p className="text-[13px] text-slate-400 mt-0.5">Manage your workflow</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowTeamModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <Users className="h-4 w-4" /> Team
            </button>
            <form onSubmit={addTask} className="flex items-center gap-2.5">
              <input
                type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?" disabled={isAdding}
                className="w-64 rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:opacity-60"
              />
              <button type="submit" disabled={!newTaskTitle.trim() || isAdding}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Task
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ──── Search & Summary ──── */}
      <SearchSummaryBar
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        allLabels={allLabels} selectedLabelId={selectedLabelId} onSelectLabel={setSelectedLabelId}
        teamMembers={teamMembers}
        totalTasks={filteredTasks.length} completedTasks={completedCount} overdueTasks={overdueCount}
      />

      {/* ──── Board ──── */}
      <main className="flex-1 overflow-x-auto">
        <div className="max-w-[1440px] mx-auto p-8">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-4 gap-5 min-w-[960px]">
              {COLUMNS.map(col => {
                const colTasks = filteredTasks.filter(t => t.status === col.id)
                return (
                  <section key={col.id} className="flex flex-col rounded-xl bg-slate-100/50 min-h-[calc(100vh-280px)]">
                    {/* Column header */}
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">{col.title}</h2>
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 min-w-[20px]">{colTasks.length}</span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef} {...provided.droppableProps}
                          className={`flex-1 flex flex-col gap-2.5 px-3 pb-3 pt-1 transition-colors duration-200 rounded-b-xl ${snapshot.isDraggingOver ? 'bg-indigo-50/40' : ''}`}
                        >
                          {colTasks.map((task, index) => {
                            const labels = taskLabelsMap[task.id] ?? []
                            const overdue = isOverdue(task.due_date, task.status)

                            return (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef} {...provided.draggableProps}
                                    onClick={() => !snapshot.isDragging && openDetail(task.id)}
                                    className={`group relative bg-white rounded-lg border p-3 select-none transition-all duration-200 cursor-pointer ${
                                      snapshot.isDragging
                                        ? 'shadow-lg rotate-[2deg] ring-2 ring-indigo-500/30 border-transparent scale-[1.02]'
                                        : 'border-slate-200 hover:shadow-md hover:border-slate-300'
                                    }`}
                                  >
                                    {/* Row 1: grip + title + delete */}
                                    <div className="flex items-start gap-2">
                                      <div
                                        {...provided.dragHandleProps}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`mt-[1px] shrink-0 cursor-grab active:cursor-grabbing text-slate-300 transition-opacity duration-150 ${
                                          snapshot.isDragging ? 'opacity-100 text-indigo-400' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                      <p className="flex-1 text-[13px] font-medium text-slate-700 leading-snug break-words min-w-0">{task.title}</p>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                                        className={`shrink-0 p-1 rounded-md text-slate-300 transition-all duration-150 hover:text-red-500 hover:bg-red-50 ${
                                          snapshot.isDragging ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>

                                    {/* Row 2: meta badges */}
                                    {(task.priority || task.due_date || labels.length > 0 || task.assignee_name) && (
                                      <div className="flex items-center flex-wrap gap-1.5 mt-2.5 ml-6">
                                        {task.priority && <PriorityBadge priority={task.priority} />}
                                        {task.due_date && (
                                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                            overdue ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                                          }`}>
                                            <CalendarDays className={`h-3 w-3 ${overdue ? 'text-red-500' : ''}`} />
                                            {formatDate(task.due_date)}
                                          </span>
                                        )}
                                        {labels.map(l => <LabelBadge key={l.id} label={l} />)}
                                        {task.assignee_name && (() => {
                                          const member = teamMembers.find(m => m.name === task.assignee_name)
                                          return <AvatarCircle name={task.assignee_name} color={member?.color} />
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}

                          {provided.placeholder}

                          {colTasks.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200/80 py-10 mt-1">
                              <Inbox className="h-6 w-6 text-slate-300" />
                              <p className="text-[13px] text-slate-400 font-medium">Drop tasks here</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </section>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      </main>

      {/* ──── Detail Panel ──── */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          allLabels={allLabels}
          taskLabels={taskLabelsMap[selectedTask.id] ?? []}
          comments={detailComments}
          activityLog={detailActivity}
          teamMembers={teamMembers}
          onClose={() => setSelectedTaskId(null)}
          onUpdateTask={updateTask}
          onAddComment={addComment}
          onToggleLabel={toggleLabel}
          onDeleteTask={deleteTask}
          onCreateLabel={createLabel}
        />
      )}

      {/* ──── Team Modal ──── */}
      {showTeamModal && (
        <TeamModal
          teamMembers={teamMembers}
          onClose={() => setShowTeamModal(false)}
          onAddMember={addTeamMember}
          onRemoveMember={removeTeamMember}
        />
      )}
    </div>
  )
}
