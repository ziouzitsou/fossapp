/**
 * Extract thumbnail URL from multimedia array
 * Priority: MD47 (Supabase thumbnail) → MD02 (print-ready) → MD01 (supplier external)
 * NOTE: This is domain-specific, stays in the app (not moved to @fossapp/ui)
 */
export function getThumbnailUrl(
  multimedia?: Array<{ mime_code: string; mime_source: string }>
): string | null {
  if (!multimedia || multimedia.length === 0) return null

  // Priority order for thumbnails
  const priorityOrder = ['MD47', 'MD02', 'MD01']

  for (const code of priorityOrder) {
    const item = multimedia.find(m => m.mime_code === code)
    if (item?.mime_source) return item.mime_source
  }

  return null
}
