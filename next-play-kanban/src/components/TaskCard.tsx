import { Draggable } from '@hello-pangea/dnd'
import { GripVertical, Trash2, CalendarDays } from 'lucide-react'
import type { Task, Label, TeamMember } from '../types'
import { isOverdue, formatDate } from '../utils/helpers'
import { PriorityBadge } from './PriorityBadge'
import { AvatarCircle } from './AvatarCircle'
import { LabelBadge } from './LabelBadge'

interface TaskCardProps {
  task: Task
  index: number
  labels: Label[]
  teamMembers: TeamMember[]
  onOpenDetail: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
}

/**
 * Individual draggable unit representing a Kanban item.
 * Embedded securely within a dnd wrapper (Draggable).
 * 
 * @param props.task - Full task data structure.
 * @param props.index - Internal map index necessary for DnD sort tracking.
 * @param props.labels - Assigned visual labels metadata.
 * @param props.teamMembers - Database team rosters for avatar rendering.
 * @param props.onOpenDetail - Callback to slide open the side panel viewer.
 * @param props.onDeleteTask - Callback to immediately trash the item.
 */
export function TaskCard({ task, index, labels, teamMembers, onOpenDetail, onDeleteTask }: TaskCardProps) {
  const overdue = isOverdue(task.due_date, task.status)

  return (
    <Draggable key={task.id} draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef} {...provided.draggableProps}
          onClick={() => !snapshot.isDragging && onOpenDetail(task.id)}
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
              onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id) }}
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
}
