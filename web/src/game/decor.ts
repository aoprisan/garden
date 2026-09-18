// decor.csv → everything you can put in the garden that isn't a plant. The
// brief asks players to "design and grow their gardens"; plants are the growing
// half, this file is the designing half.
//
//   id,name,kind,form,color,accent,petals,blurb
//
// Same deal as plants.csv: a row is a thing, no code and no rebuild (see
// game/config.ts and the Config panel). Decoration is bought with petals and
// costs nothing to place; it never affects growth, so no number in here can
// move the balance.
import { parseCSV } from './csv'
import type { Decor, DecorForm, DecorKind } from '../types'

export interface ParsedDecor {
  decor: Decor[]
  warnings: string[]
}

const KINDS: DecorKind[] = ['ground', 'object', 'pot']
const FORMS: DecorForm[] = [
  'path', 'gravel', 'grass', 'water',
  'fence', 'rock', 'bench', 'lantern', 'birdbath', 'arch', 'pot', 'trough',
]

/** Forms that lie in the ground plane. They're painted flat into the tile
 *  rather than billboarded upright — a pond standing on its edge would be a
 *  strange garden. Independent of `kind`: a pond is an `object` (nothing else
 *  fits in that cell) that happens to be drawn flat. */
const FLAT_FORMS = new Set<DecorForm>(['path', 'gravel', 'grass', 'water'])

export function isFlatForm(form: DecorForm): boolean {
  return FLAT_FORMS.has(form)
}

const COLUMNS = ['id', 'name', 'kind', 'form', 'color', 'accent', 'petals', 'blurb'] as const

/** Parse the decor CSV. Unlike plants.csv this never throws: a garden with no
 *  decoration is still a garden, so an unreadable file costs you the ornaments
 *  and nothing else. */
export function parseDecorCsv(text: string): ParsedDecor {
  const rows = parseCSV(text)
  const warnings: string[] = []
  if (rows.length === 0) return { decor: [], warnings: ['decor.csv is empty — no decoration in the shed'] }

  const header = rows[0].map(c => c.toLowerCase())
  const hasHeader = header.includes('id') && header.includes('name')
  const col = new Map<string, number>()
  if (hasHeader) {
    for (const name of COLUMNS) {
      const at = header.indexOf(name)
      if (at >= 0) col.set(name, at)
      else warnings.push(`decor.csv: no "${name}" column — falling back to its default`)
    }
  } else {
    COLUMNS.forEach((name, i) => col.set(name, i))
  }

  const cell = (row: string[], name: (typeof COLUMNS)[number]): string => {
    const at = col.get(name)
    return at === undefined ? '' : (row[at] ?? '').trim()
  }

  const decor: Decor[] = []
  const seen = new Set<string>()
  for (const [i, row] of rows.entries()) {
    if (hasHeader && i === 0) continue
    const line = i + 1
    const id = slug(cell(row, 'id') || cell(row, 'name'))
    const name = cell(row, 'name') || cell(row, 'id')
    if (!id || !name) { warnings.push(`decor.csv line ${line}: row has no id or name — skipped`); continue }
    if (seen.has(id)) { warnings.push(`decor.csv line ${line}: duplicate "${id}" — skipped`); continue }

    const rawKind = cell(row, 'kind').toLowerCase() as DecorKind
    const kind = KINDS.includes(rawKind)
      ? rawKind
      : fallback(warnings, line, `kind "${cell(row, 'kind')}"`, 'object' as DecorKind)
    const rawForm = cell(row, 'form').toLowerCase() as DecorForm
    const form = FORMS.includes(rawForm)
      ? rawForm
      : fallback(warnings, line, `form "${cell(row, 'form')}"`, (kind === 'ground' ? 'path' : 'rock') as DecorForm)

    // A blank price must not read as free: Number('') is 0, so an empty column
    // would put an ornament in the shed for nothing.
    const rawPetals = cell(row, 'petals')
    const petals = rawPetals === '' ? NaN : Number(rawPetals)
    if (rawPetals !== '' && !(Number.isFinite(petals) && petals >= 0)) {
      warnings.push(`decor.csv line ${line}: price for "${id}" is not a number — using 5`)
    }

    seen.add(id)
    decor.push({
      id,
      name,
      kind,
      form,
      color: color(cell(row, 'color'), '#9a958c'),
      accent: color(cell(row, 'accent'), '#6f6a62'),
      petals: Number.isFinite(petals) && petals >= 0 ? Math.round(petals) : 5,
      blurb: cell(row, 'blurb'),
    })
  }

  if (decor.length === 0) warnings.push('decor.csv has no readable rows — no decoration in the shed')
  return { decor, warnings }
}

function fallback<T>(warnings: string[], line: number, what: string, value: T): T {
  warnings.push(`decor.csv line ${line}: unknown ${what} — using "${String(value)}"`)
  return value
}

/** Accepts #rgb/#rrggbb (and bare hex without the #); anything else is the
 *  default, so a typo tints one bench rather than breaking the render. */
function color(raw: string, dflt: string): string {
  const v = raw.startsWith('#') ? raw : `#${raw}`
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : dflt
}

function slug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
