import * as XLSX from 'xlsx'

/**
 * Reads a spreadsheet-style upload — CSV, TSV, plain text, or Excel
 * (.xlsx / .xls) — into a 2-D array of trimmed string cells (rows × columns).
 *
 * This is the single entry point both the training-attendance import and the
 * match-stats import use, so a manager can drop either a CSV or an Excel file
 * and the downstream parsing logic never has to care which it was.
 *
 * Excel files are parsed from the FIRST sheet only. Empty rows are dropped.
 */
export async function readTabularFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  const isExcel =
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type.includes('spreadsheetml') ||
    file.type === 'application/vnd.ms-excel'

  if (isExcel) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const firstSheetName = wb.SheetNames[0]
    if (!firstSheetName) return []
    const sheet = wb.Sheets[firstSheetName]
    // header:1 → array-of-arrays; defval:'' keeps column positions stable even
    // when a cell is blank, so "8,,1,5" style gaps don't shift later columns.
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    })
    return rows
      .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []))
      .filter((r) => r.some((c) => c !== ''))
  }

  // CSV / TSV / plain text — naive split (cell values here are names & numbers,
  // which don't contain embedded separators), matching the app's other parsers.
  const text = await file.text()
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes('\t') ? '\t' : ','
      return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    })
}
