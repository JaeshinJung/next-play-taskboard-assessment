import { useState, useEffect, useRef } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import {
  GripVertical,
  Plus,
  Loader2,
  Layout,
  Inbox,
  Trash2,
} from 'lucide-react'
import { supabase } from './supabase'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Task {
  id: string
  title: string
  status: string
  user_id: string
}

/* ------------------------------------------------------------------ */
/*  Column definitions                                                 */
/* ------------------------------------------------------------------ */

const COLUMNS = [
  { id: 'To Do',       title: 'To Do' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'In Review',   title: 'In Review' },
  { id: 'Done',        title: 'Done' },
] as const

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

export default function App() {
  const [tasks, setTasks]             = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [userId, setUserId]           = useState<string | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [isAdding, setIsAdding]       = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle]   = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  /* ---------- bootstrap: anonymous auth → fetch tasks ---------- */

  useEffect(() => {
    const init = async () => {
      try {
        // Check for an existing session first
        const {
          data: { session },
        } = await supabase.auth.getSession()

        let user = session?.user

        // If no session, sign in anonymously
        if (!user) {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          user = data.user
        }

        if (user) {
          setUserId(user.id)
          await fetchTasks(user.id)
        }
      } catch (err) {
        console.error('Auth / fetch failed:', err)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  /* ---------- CRUD helpers ---------- */

  const fetchTasks = async (uid: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .order('id', { ascending: true })

    if (error) {
      console.error('Error fetching tasks:', error)
      return
    }
    setTasks((data ?? []) as Task[])
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTaskTitle.trim()
    if (!title || !userId) return

    setIsAdding(true)
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ title, status: 'To Do', user_id: userId }])
      .select()

    if (error) {
      console.error('Error adding task:', error)
    } else if (data && data.length > 0) {
      setTasks((prev) => [...prev, data[0] as Task])
      setNewTaskTitle('')
    }
    setIsAdding(false)
  }

  /* ---------- Delete task ---------- */

  const deleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return

    // Optimistic removal
    setTasks((prev) => prev.filter((t) => t.id !== taskId))

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error('Error deleting task:', error)
      if (userId) fetchTasks(userId) // Revert on failure
    }
  }

  /* ---------- Rename (inline edit) ---------- */

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingTitle(task.title)
    // Focus the input on next render
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const cancelEditing = () => {
    setEditingTaskId(null)
    setEditingTitle('')
  }

  const saveEditing = async () => {
    const trimmed = editingTitle.trim()
    if (!editingTaskId || !trimmed) {
      cancelEditing()
      return
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === editingTaskId ? { ...t, title: trimmed } : t))
    )
    const taskIdToUpdate = editingTaskId
    cancelEditing()

    const { error } = await supabase
      .from('tasks')
      .update({ title: trimmed })
      .eq('id', taskIdToUpdate)

    if (error) {
      console.error('Error updating task title:', error)
      if (userId) fetchTasks(userId)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEditing()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  /* ---------- Drag-and-drop handler ---------- */

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return

    const newStatus = destination.droppableId

    // Optimistic reorder
    setTasks((prev) => {
      const copy = [...prev]
      const idx = copy.findIndex((t) => String(t.id) === draggableId)
      if (idx === -1) return prev

      const [moved] = copy.splice(idx, 1)
      moved.status = newStatus

      // Collect tasks already in the destination column (preserving order)
      const destTasks = copy.filter((t) => t.status === newStatus)
      const otherTasks = copy.filter((t) => t.status !== newStatus)

      destTasks.splice(destination.index, 0, moved)
      return [...otherTasks, ...destTasks]
    })

    // Persist
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', draggableId)

    if (error) {
      console.error('Error updating task:', error)
      // Revert on failure
      if (userId) fetchTasks(userId)
    }
  }

  /* ---------- Render ---------- */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-['Inter',ui-sans-serif,system-ui,sans-serif] antialiased">
      {/* ────────────────── Header ────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-8 py-4">
          {/* Left – branding */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Layout className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight leading-none">
                Project Tasks
              </h1>
              <p className="text-[13px] text-slate-400 mt-0.5">
                Manage your workflow
              </p>
            </div>
          </div>

          {/* Right – add task form */}
          <form onSubmit={addTask} className="flex items-center gap-2.5">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              disabled={isAdding}
              className="w-72 rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim() || isAdding}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Task
            </button>
          </form>
        </div>
      </header>

      {/* ────────────────── Board ────────────────── */}
      <main className="flex-1 overflow-x-auto">
        <div className="max-w-[1440px] mx-auto p-8">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-4 gap-5 min-w-[960px]">
              {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.id)

                return (
                  <section
                    key={col.id}
                    className="flex flex-col rounded-xl bg-slate-100/50 min-h-[calc(100vh-180px)]"
                  >
                    {/* Column header */}
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                        {col.title}
                      </h2>
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 min-w-[20px]">
                        {colTasks.length}
                      </span>
                    </div>

                    {/* Droppable area */}
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 flex flex-col gap-2.5 px-3 pb-3 pt-1 transition-colors duration-200 rounded-b-xl ${
                            snapshot.isDraggingOver
                              ? 'bg-indigo-50/40'
                              : ''
                          }`}
                        >
                          {colTasks.map((task, index) => {
                            const isEditing = editingTaskId === task.id

                            return (
                            <Draggable
                              key={String(task.id)}
                              draggableId={String(task.id)}
                              index={index}
                              isDragDisabled={isEditing}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`group relative bg-white rounded-lg border p-3 flex items-start gap-2 select-none transition-all duration-200
                                    ${
                                      isEditing
                                        ? 'ring-2 ring-indigo-400/40 border-indigo-300 shadow-sm'
                                        : snapshot.isDragging
                                          ? 'shadow-lg rotate-[2deg] ring-2 ring-indigo-500/30 border-transparent scale-[1.02]'
                                          : 'border-slate-200 hover:shadow-md hover:border-slate-300'
                                    }
                                  `}
                                >
                                  {/* Grip handle — visible only on hover */}
                                  <div
                                    {...provided.dragHandleProps}
                                    className={`mt-[1px] shrink-0 cursor-grab active:cursor-grabbing text-slate-300 transition-opacity duration-150 ${
                                      isEditing
                                        ? 'opacity-0 pointer-events-none'
                                        : snapshot.isDragging
                                          ? 'opacity-100 text-indigo-400'
                                          : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </div>

                                  {/* Task title — click to edit */}
                                  <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                      <input
                                        ref={editInputRef}
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        onBlur={saveEditing}
                                        className="w-full text-[13px] font-medium text-slate-700 leading-snug bg-indigo-50/50 border border-indigo-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      />
                                    ) : (
                                      <p
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          startEditing(task)
                                        }}
                                        className="text-[13px] font-medium text-slate-700 leading-snug break-words min-w-0 cursor-text hover:text-slate-900 transition-colors"
                                        title="Click to rename"
                                      >
                                        {task.title}
                                      </p>
                                    )}
                                  </div>

                                  {/* Delete button — visible only on hover */}
                                  {!isEditing && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteTask(task.id)
                                      }}
                                      className={`shrink-0 p-1 rounded-md text-slate-300 transition-all duration-150 hover:text-red-500 hover:bg-red-50 ${
                                        snapshot.isDragging
                                          ? 'opacity-0 pointer-events-none'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                      title="Delete task"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </Draggable>
                            )
                          })}

                          {provided.placeholder}

                          {/* Empty state */}
                          {colTasks.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200/80 py-10 mt-1">
                              <Inbox className="h-6 w-6 text-slate-300" />
                              <p className="text-[13px] text-slate-400 font-medium">
                                Drop tasks here
                              </p>
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
    </div>
  )
}
