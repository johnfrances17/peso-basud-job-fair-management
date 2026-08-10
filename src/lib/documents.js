// Staged document-change helpers.
//
// Uploads and removals made inside the add/edit form are held client-side
// until the member record is saved ("Apply Changes"), mirroring how the
// regular fields behave with Discard Changes. Nothing is written to the
// database or Supabase Storage until then, so a cancel never leaves orphaned
// files. These helpers keep the DocumentsSection rendering in sync with the
// staged plan.

export function getDocumentStatusCounts({
  attachments = [],
  pendingUploads = [],
  pendingRemovals = [],
  type,
}) {
  const saved = attachments.filter((attachment) => attachment.documentType === type)
  const removingIds = new Set(pendingRemovals)
  const kept = saved.filter((attachment) => !removingIds.has(attachment.id))
  const staged = pendingUploads.filter((item) => item.type === type)

  return {
    keptCount: kept.length,
    removedCount: saved.length - kept.length,
    stagedCount: staged.length,
    totalCount: kept.length + staged.length,
  }
}
