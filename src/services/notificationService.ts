import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { createLogger } from '../lib/logger'

const logger = createLogger({ scope: 'notificationService' })

const notificationLimitSchema = z.number().int().min(1).max(50).default(20)
const notificationIdSchema = z.string().uuid()

const projectNotificationRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  recipient_user_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  type: z.enum([
    'project_assigned',
    'project_unassigned',
    'project_status_changed',
    'project_archived',
    'project_restored',
    'workspace_member_joined',
    'workspace_member_removed',
    'workspace_invite_received',
    'workspace_join_requested',
    'workspace_join_accepted',
    'workspace_join_declined',
    'workspace_welcome'
  ]),
  title: z.string().min(1),
  body: z.string().min(1),
  is_read: z.boolean(),
  created_at: z.string().min(1)
})

export type ProjectNotificationType = z.infer<typeof projectNotificationRowSchema>['type']

export interface ProjectNotification {
  id: string
  workspaceId: string | null
  projectId: string | null
  recipientUserId: string
  actorUserId: string | null
  type: ProjectNotificationType
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

const mapProjectNotification = (row: unknown): ProjectNotification => {
  const parsedRow = projectNotificationRowSchema.parse(row)

  return {
    id: parsedRow.id,
    workspaceId: parsedRow.workspace_id,
    projectId: parsedRow.project_id,
    recipientUserId: parsedRow.recipient_user_id,
    actorUserId: parsedRow.actor_user_id,
    type: parsedRow.type,
    title: parsedRow.title,
    body: parsedRow.body,
    isRead: parsedRow.is_read,
    createdAt: parsedRow.created_at
  }
}

const isMissingNotificationsTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''

  return code === '42P01' || message.includes('project_notifications')
}

/**
 * Loads the current user's newest project notifications.
 *
 * @param {number} limit
 * @returns {Promise<ProjectNotification[]>}
 *
 * @example
 * const notifications = await listProjectNotifications(20)
 */
export const listProjectNotifications = async (limit = 20): Promise<ProjectNotification[]> => {
  try {
    const safeLimit = notificationLimitSchema.parse(limit)
    const { data, error } = await supabase
      .from('project_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) {
      if (isMissingNotificationsTableError(error)) {
        logger.warn('Project notifications table is not available yet. Run the latest Supabase migration.', error)
        return []
      }

      throw error
    }

    return (data || []).map(mapProjectNotification)
  } catch (error) {
    logger.error('Failed to load project notifications.', error)
    throw new Error('Unable to load project notifications.')
  }
}

/**
 * Marks one project notification as read for the current user.
 *
 * @param {string} notificationId
 * @returns {Promise<void>}
 *
 * @example
 * await markProjectNotificationRead(notification.id)
 */
export const markProjectNotificationRead = async (notificationId: string): Promise<void> => {
  try {
    const safeNotificationId = notificationIdSchema.parse(notificationId)
    const { error } = await supabase
      .from('project_notifications')
      .update({ is_read: true })
      .eq('id', safeNotificationId)

    if (error) {
      throw error
    }
  } catch (error) {
    logger.error('Failed to mark the project notification as read.', { notificationId, error })
    throw new Error('Unable to mark the notification as read.')
  }
}

/**
 * Marks all project notifications as read for the current user.
 *
 * @returns {Promise<void>}
 *
 * @example
 * await markAllProjectNotificationsRead()
 */
export const markAllProjectNotificationsRead = async (): Promise<void> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError) {
      throw userError
    }

    if (!user) {
      throw new Error('User authentication is required to update notifications.')
    }

    const { error } = await supabase
      .from('project_notifications')
      .update({ is_read: true })
      .eq('recipient_user_id', user.id)
      .eq('is_read', false)

    if (error) {
      throw error
    }
  } catch (error) {
    logger.error('Failed to mark all project notifications as read.', error)
    throw new Error('Unable to mark notifications as read.')
  }
}

/**
 * Deletes all project notifications for the current user.
 *
 * @returns {Promise<void>}
 *
 * @example
 * await clearProjectNotifications()
 */
export const clearProjectNotifications = async (): Promise<void> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError) {
      throw userError
    }

    if (!user) {
      throw new Error('User authentication is required to clear notifications.')
    }

    const { error } = await supabase
      .from('project_notifications')
      .delete()
      .eq('recipient_user_id', user.id)

    if (error) {
      throw error
    }
  } catch (error) {
    logger.error('Failed to clear project notifications.', error)
    throw new Error('Unable to clear notifications.')
  }
}
