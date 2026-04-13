import { supabase } from '../supabase'
import type { Task, Label, TeamMember } from '../types'

/**
 * Fetches all tasks designated to a specific user.
 * @param uid - The unique identifier of the user (e.g. Supabase Auth ID).
 * @returns Array of Tasks.
 */
export async function fetchTasks(uid: string): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', uid).order('id', { ascending: true })
  if (error) { console.error('Fetch tasks error:', error); return [] }
  return (data ?? []) as Task[]
}

/**
 * Fetches all available global labels mapped in the system.
 * @returns Array of Label objects.
 */
export async function fetchLabels(): Promise<Label[]> {
  const { data, error } = await supabase.from('labels').select('*').order('name', { ascending: true })
  if (error) { console.error('Fetch labels error:', error); return [] }
  return (data ?? []) as Label[]
}

/**
 * Fetches join-table connections and resolves them mapping task IDs to label records.
 * @returns A dictionary of taskIds pointing to an array of assigned Labels.
 */
export async function fetchAllTaskLabels(): Promise<Record<string, Label[]>> {
  const { data, error } = await supabase.from('task_labels').select('task_id, label_id, labels(id, name, color)')
  if (error) { console.error('Fetch task_labels error:', error); return {} }
  const map: Record<string, Label[]> = {}
  for (const row of (data ?? []) as any[]) {
    const tid = row.task_id as string
    if (!map[tid]) map[tid] = []
    if (row.labels) map[tid].push(row.labels as Label)
  }
  return map
}

/**
 * Fetches the directory of assignable team members.
 * @returns Array of TeamMember records.
 */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from('team_members').select('*').order('name', { ascending: true })
  if (error) { console.error('Fetch team_members error:', error); return [] }
  return (data ?? []) as TeamMember[]
}
