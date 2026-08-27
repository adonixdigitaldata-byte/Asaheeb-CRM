import { createServiceClient } from '@/lib/supabase/server'

export interface LogCmsActivityParams {
  entityType: 'PROJECT' | 'BLOG'
  entityId: string
  actionType:
    | 'CREATED'
    | 'UPDATED_DETAILS'
    | 'UPDATED_PHOTOS'
    | 'UPDATED_COMMISSION'
    | 'PUBLISHED'
    | 'UNPUBLISHED'
    | 'DELETED'
    | 'COMMISSION_RECORDED'
    | 'COMMISSION_UPDATED'
    | 'COMMISSION_DELETED'
    | 'CUSTOM'
  actorId?: string | null
  actorName: string
  actorEmail?: string | null
  description: string
  metadata?: Record<string, any>
}

export async function logCmsActivity({
  entityType,
  entityId,
  actionType,
  actorId,
  actorName,
  actorEmail,
  description,
  metadata = {},
}: LogCmsActivityParams) {
  try {
    const serviceClient = await createServiceClient()
    const { error } = await serviceClient.from('cms_activities').insert({
      entity_type: entityType,
      entity_id: entityId,
      action_type: actionType,
      actor_id: actorId || null,
      actor_name: actorName || 'Team Member',
      actor_email: actorEmail || null,
      description,
      metadata,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.warn('Could not insert cms_activity:', error.message)
    }
  } catch (err) {
    console.warn('Failed to log CMS activity (non-fatal):', err)
  }
}
