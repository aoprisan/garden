// Minimal CSV read/write shared by every config file the game loads at runtime.
// Deliberately dependency-free: the same code parses the CSVs bundled with the
// build AND the ones a gardener uploads in the Config panel, so what you see in
// a spreadsheet is exactly what the game reads.

/** Split CSV text into rows of trimmed cells. Handles quoted fields (and ""
 *  escapes); blank lines are skipped. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue
    const cells: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i]
      if (inQ) {
        if (c === '"' && raw[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') inQ = false
        else cur += c
      } else if (c === '"') inQ = true
      else if (c === ',') { cells.push(cur); cur = '' }
      else cur += c
    }
    cells.push(cur)
    rows.push(cells.map(s => s.trim()))
  }
  return rows
}

/** Quote a cell only when it would otherwise break the row. */
function cell(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Serialize rows back to CSV text (trailing newline, so the file ends clean). */
export function formatCSV(rows: (string | number)[][]): string {
  return rows.map(r => r.map(cell).join(',')).join('\n') + '\n'
}

/** A CSV cell as a finite number, or `fallback` when it's blank/not numeric. */
export function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
