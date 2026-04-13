/**
 * Represents a standard task in the Kanban board.
 */
export interface Task {
  id: string
  title: string
  status: string
  user_id: string
  description: string | null
  priority: 'high' | 'medium' | 'low' | null
  assignee_name: string | null
  due_date: string | null
}

/**
 * Represents a user comment on a specific task.
 */
export interface Comment {
  id: string
  task_id: string
  content: string
  created_at: string
}

/**
 * Captures historical actions performed on a task for audit trails.
 */
export interface ActivityLogEntry {
  id: string
  task_id: string
  action: string
  details: string | null
  created_at: string
}

/**
 * Visual tags that can be applied to tasks for categorization.
 */
export interface Label {
  id: string
  name: string
  color: string
}

/**
 * A user available to be assigned to tasks.
 */
export interface TeamMember {
  id: string
  name: string
  color: string
}
