import { Droppable } from '@hello-pangea/dnd'
import { Inbox } from 'lucide-react'
import type { Task, Label, TeamMember } from '../types'
import { TaskCard } from './TaskCard'

interface ColumnProps {
  col: { id: string; title: string }
  colTasks: Task[]
  taskLabelsMap: Record<string, Label[]>
  teamMembers: TeamMember[]
  onOpenDetail: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
}

/**
 * A vertical lane that accepts incoming Draggable drops.
 * Iterates TaskCards securely wrapped in a Droppable scope.
 *
 * @param props.col - Identifier configuration (id, title).
 * @param props.colTasks - Tasks mapped into this specific status.
 * @param props.taskLabelsMap - Dictionary pointing taskId to Label[].
 * @param props.teamMembers - Database team roster array.
 * @param props.onOpenDetail - Passed to children to spawn details panel.
 * @param props.onDeleteTask - Passed to children to delete.
 */
export function Column({ col, colTasks, taskLabelsMap, teamMembers, onOpenDetail, onDeleteTask }: ColumnProps) {
  return (
    <section className="flex flex-col rounded-xl bg-slate-100/50 min-h-[calc(100vh-280px)]">
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
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  labels={labels}
                  teamMembers={teamMembers}
                  onOpenDetail={onOpenDetail}
                  onDeleteTask={onDeleteTask}
                />
              )
            })}
            
            {/* Critical constraint: placement of placeholder to maintain list height */}
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
}
