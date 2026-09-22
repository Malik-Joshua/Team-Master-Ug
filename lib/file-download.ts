/**
 * Downloads an uploaded file in the exact format it was originally
 * uploaded in (xlsx stays xlsx, csv stays csv, etc.) — for the gym metrics
 * and training attendance "download this upload" buttons.
 *
 * Two cases:
 *   1. A signed storage URL exists (`downloadUrl`, e.g. from Supabase
 *      Storage) — fetch it and re-issue the download as a same-origin
 *      blob: URL. This matters because a plain
 *      `<a href={crossOriginUrl} download>` does NOT work: the HTML
 *      `download` attribute is silently ignored by browsers for
 *      cross-origin links (the spec requires same-origin), so clicking it
 *      just navigates to the file and renders it inline (e.g. a CSV shown
 *      as a raw text page) instead of saving it.
 *   2. No storage URL (legacy uploads, or a backend that never persisted
 *      the original file) — reconstruct a CSV from the parsed `rows` and
 *      download that instead, so there's always something to save.
 */
export async function downloadUploadedFile(params: {
  downloadUrl?: string | null
  rows?: string[][] | null
  fileName: string
}) {
  const { downloadUrl, rows, fileName } = params

  const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (downloadUrl) {
    try {
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const blob = await res.blob()
      saveBlob(blob, fileName)
      return
    } catch (err) {
      // Storage fetch failed (expired signed URL, network blip, etc.) — fall
      // through to the rows-based reconstruction below if we have one,
      // rather than leaving the user with nothing.
      console.warn('[downloadUploadedFile] signed-URL fetch failed, falling back to rows:', err)
    }
  }

  if (rows && rows.length > 0) {
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    saveBlob(new Blob([csv], { type: 'text/csv' }), fileName)
    return
  }

  throw new Error('No downloadable content available for this file.')
}
