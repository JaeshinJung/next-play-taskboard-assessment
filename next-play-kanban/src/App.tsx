import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  DragDropContext,
  type DropResult,
} from '@hello-pangea/dnd'
import { Plus, Loader2, Layout, Users } from 'lucide-react'
import { supabase } from './supabase'

// Types
import type { Task, Label, Comment, ActivityLogEntry, TeamMember } from './types'
// Utils & Constants
import { COLUMNS } from './utils/constants'
import { isOverdue, formatDate } from './utils/helpers'
// Services
import { fetchTasks, fetchLabels, fetchAllTaskLabels, fetchTeamMembers } from './services/api'
// Components
import { Column } from './components/Column'
import { TeamModal } from './components/TeamModal'
import { SearchSummaryBar } from './components/SearchSummaryBar'
import { TaskDetailPanel } from './components/TaskDetailPanel'

/**
 * The root container binding local state, Supabase integrations, and layout configuration.
 * Coordinates drag-and-drop context mapping and acts as the primary source of truth.
 */
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

  /* --- UI State --- */
  const [selectedTaskId, setSelectedTaskId]   = useState<string | null>(null)
  const [detailComments, setDetailComments]   = useState<Comment[]>([])
  const [detailActivity, setDetailActivity]   = useState<ActivityLogEntry[]>([])

  /* --- Derived State --- */

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

  /* --- Initialization Hook --- */

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let user = session?.user ?? null
        if (!user) {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          user = data.user
        }
        if (user) {
          setUserId(user.id)
          await Promise.all([
            loadTasks(user.id),
            loadLabels(),
            loadAllTaskLabels(),
            loadTeamMembers(),
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

  /* --- Supabase Data Loading --- */

  const loadTasks = async (uid: string) => {
    const data = await fetchTasks(uid)
    setTasks(data)
  }

  const loadLabels = async () => {
    const data = await fetchLabels()
    setAllLabels(data)
  }

  const loadAllTaskLabels = async () => {
    const map = await fetchAllTaskLabels()
    setTaskLabelsMap(map)
  }

  const loadTeamMembers = async () => {
    const data = await fetchTeamMembers()
    setTeamMembers(data)
  }

  /* --- Team Member Handlers --- */

  const addTeamMember = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase.from('team_members').insert([{ name, color }]).select()
    if (error) { console.error('Add team member:', error); return }
    if (data && data.length > 0) setTeamMembers(prev => [...prev, data[0] as TeamMember])
  }, [])

  const removeTeamMember = useCallback(async (id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id))
    const { error } = await supabase.from('team_members').delete().eq('id', id)
    if (error) { console.error('Remove team member:', error); loadTeamMembers() }
  }, [])

  const fetchTaskDetail = async (taskId: string) => {
    const [commentsRes, activityRes] = await Promise.all([
      supabase.from('comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase.from('activity_log').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
    ])
    setDetailComments((commentsRes.data ?? []) as Comment[])
    setDetailActivity((activityRes.data ?? []) as ActivityLogEntry[])
  }

  /* --- Task Handlers --- */

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



  const deleteTask = useCallback(async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    if (selectedTaskId === taskId) setSelectedTaskId(null)
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) { console.error('Delete:', error); if (userId) loadTasks(userId) }
  }, [selectedTaskId, userId])



  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))

    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (error) { console.error('Update:', error); if (userId) loadTasks(userId); return }

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

  /* --- Comment Handlers --- */

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

  /* --- Label Handlers --- */

  const toggleLabel = useCallback(async (taskId: string, labelId: string, isAssigned: boolean) => {
    const label = allLabels.find(l => l.id === labelId)
    if (!label) return

    let action = ''
    if (isAssigned) {
      setTaskLabelsMap(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(l => l.id !== labelId) }))
      await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId)
      action = 'Label Removed'
    } else {
      setTaskLabelsMap(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), label] }))
      await supabase.from('task_labels').insert([{ task_id: taskId, label_id: labelId }])
      action = 'Label Added'
    }

    await supabase.from('activity_log').insert([{ 
      task_id: taskId, 
      action, 
      details: label.name 
    }])

    if (selectedTaskId === taskId) {
      const { data: a } = await supabase.from('activity_log').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
      setDetailActivity((a ?? []) as ActivityLogEntry[])
    }
  }, [allLabels, selectedTaskId])



  const createLabel = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase.from('labels').insert([{ name, color }]).select()
    if (error) { console.error('Create label:', error); return }
    if (data && data.length > 0) {
      setAllLabels(prev => [...prev, data[0] as Label])
    }
  }, [])

  const deleteLabel = useCallback(async (id: string) => {
    // Optimistic UI updates
    setAllLabels(prev => prev.filter(l => l.id !== id))
    setTaskLabelsMap(prev => {
      const next = { ...prev }
      for (const taskId in next) {
        next[taskId] = next[taskId].filter(l => l.id !== id)
      }
      return next
    })
    setSelectedLabelId(prev => prev === id ? null : prev)
    
    // DB delete: Sequential deletion to handle foreign key constraints
    // First, remove all associations in the join table
    const { error: cascadeError } = await supabase.from('task_labels').delete().eq('label_id', id)
    if (cascadeError) console.error('Delete task_labels (cascade) error:', cascadeError)

    // Then, remove the label itself
    const { error } = await supabase.from('labels').delete().eq('id', id)
    if (error) { console.error('Delete label error:', error) }
  }, [])

  /* --- Drag & Drop Handlers --- */

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
    if (error) { console.error('DnD:', error); if (userId) loadTasks(userId); return }
    await supabase.from('activity_log').insert([{ task_id: draggableId, action: `Status changed to "${newStatus}"`, details: '' }])
  }

  /* --- UI Handlers --- */

  const openDetail = useCallback(async (taskId: string) => {
    setSelectedTaskId(taskId)
    await fetchTaskDetail(taskId)
  }, [])

  /* --- Render --- */

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
                  <Column
                    key={col.id}
                    col={col}
                    colTasks={colTasks}
                    taskLabelsMap={taskLabelsMap}
                    teamMembers={teamMembers}
                    onOpenDetail={openDetail}
                    onDeleteTask={deleteTask}
                  />
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
          onDeleteLabel={deleteLabel}
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
