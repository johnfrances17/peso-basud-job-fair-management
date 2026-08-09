import { createClient } from '@supabase/supabase-js'

// Supabase Storage adapter for member document attachments.
//
// Files live in a private bucket ("member_documents"). Only the backend talks
// to it, using the service_role key (bypasses RLS, full access). Downloads are
// proxied through the authenticated API routes so staff auth always applies.

export const BUCKET_NAME = 'member_documents'

let supabaseClient = null

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).')
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    })
  }

  return supabaseClient
}

export async function uploadAttachment({ storagePath, buffer, contentType }) {
  const client = getSupabaseClient()
  const { error } = await client.storage.from(BUCKET_NAME).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })

  if (error) {
    throw new Error(`File upload failed: ${error.message}`)
  }

  return { storagePath }
}

export async function downloadAttachment(storagePath) {
  const client = getSupabaseClient()
  const { data, error } = await client.storage.from(BUCKET_NAME).download(storagePath)

  if (error) {
    throw new Error(`File download failed: ${error.message}`)
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  return buffer
}

export async function deleteAttachment(storagePath) {
  const client = getSupabaseClient()
  const { error } = await client.storage.from(BUCKET_NAME).remove([storagePath])

  if (error) {
    throw new Error(`File delete failed: ${error.message}`)
  }
}
