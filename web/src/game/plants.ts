// plants.csv → the species catalog. One row per kind of plant; everything the
// game knows about a flower (how it looks, how long it takes, what it gives
// back) comes from here, so adding a species is adding a row — no code, no
// rebuild (see game/config.ts and the Config panel).
//
//   id,name,family,rarity,form,petal_color,leaf_color,growth_units,seed_yield,petal_yield,blurb
import { parseCSV } from './csv'
import type { PlantForm, Rarity, Species } from '../types'

export interface ParsedPlants {
  species: Species[]
  warnings: string[]
}

const FORMS: PlantForm[] = ['daisy', 'cup', 'bell', 'spike', 'globe', 'vine', 'berry', 'herb']
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare']

const COLUMNS = [
  'id', 'name', 'family', 'rarity', 'form', 'petal_color', 'leaf_color',
  'growth_units', 'seed_yield', 'petal_yield', 'blurb',
] as const

/** Parse the species CSV. Header order is honoured when a header row is
 *  present, so a spreadsheet that moved a column still reads correctly.
 *  @throws when not one usable species can be read — the caller keeps the
 *          catalog it already had rather than running on an empty garden. */
export function parsePlantsCsv(text: string): ParsedPlants {
  const rows = parseCSV(text)
  if (rows.length === 0) throw new Error('plants.csv is empty')

  const warnings: string[] = []
  const header = rows[0].map(c => c.toLowerCase())
  const hasHeader = header.includes('id') && header.includes('name')
  const col = new Map<string, number>()
  if (hasHeader) {
    for (const name of COLUMNS) {
      const at = header.indexOf(name)
      if (at >= 0) col.set(name, at)
      else warnings.push(`no "${name}" column — falling back to its default`)
    }
  } else {
    COLUMNS.forEach((name, i) => col.set(name, i))
  }

  const cell = (row: string[], name: (typeof COLUMNS)[number]): string => {
    const at = col.get(name)
    return at === undefined ? '' : (row[at] ?? '').trim()
  }

  const species: Species[] = []
  const seen = new Set<string>()
  for (const [i, row] of rows.entries()) {
    if (hasHeader && i === 0) continue
    const line = i + 1
    const id = slug(cell(row, 'id') || cell(row, 'name'))
    const name = cell(row, 'name') || cell(row, 'id')
    if (!id || !name) { warnings.push(`line ${line}: row has no id or name — skipped`); continue }
    if (seen.has(id)) { warnings.push(`line ${line}: duplicate species "${id}" — skipped`); continue }

    const rarity = RARITIES.includes(cell(row, 'rarity').toLowerCase() as Rarity)
      ? cell(row, 'rarity').toLowerCase() as Rarity
      : fallback(warnings, line, `rarity "${cell(row, 'rarity')}"`, 'common' as Rarity)
    const form = FORMS.includes(cell(row, 'form').toLowerCase() as PlantForm)
      ? cell(row, 'form').toLowerCase() as PlantForm
      : fallback(warnings, line, `form "${cell(row, 'form')}"`, 'daisy' as PlantForm)

    const growthUnits = positive(cell(row, 'growth_units'), 150)
    const seedYield = positive(cell(row, 'seed_yield'), 2)
    const petalYield = positive(cell(row, 'petal_yield'), 5)
    if (growthUnits !== Number(cell(row, 'growth_units')) && cell(row, 'growth_units') !== '') {
      warnings.push(`line ${line}: growth_units for "${id}" is not a positive number — using ${growthUnits}`)
    }

    seen.add(id)
    species.push({
      id,
      name,
      family: cell(row, 'family') || 'Unsorted',
      rarity,
      form,
      petalColor: color(cell(row, 'petal_color'), '#e88ab4'),
      leafColor: color(cell(row, 'leaf_color'), '#4f7a3a'),
      growthUnits,
      seedYield: Math.max(0, Math.round(seedYield)),
      petalYield: Math.max(0, Math.round(petalYield)),
      blurb: cell(row, 'blurb'),
    })
  }

  if (species.length === 0) throw new Error('plants.csv has no readable species')
  return { species, warnings }
}

function fallback<T>(warnings: string[], line: number, what: string, value: T): T {
  warnings.push(`line ${line}: unknown ${what} — using "${String(value)}"`)
  return value
}

function positive(raw: string, dflt: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : dflt
}

/** Accepts #rgb/#rrggbb (and bare hex without the #); anything else is the
 *  default, so a typo tints one flower rather than breaking the render. */
function color(raw: string, dflt: string): string {
  const v = raw.startsWith('#') ? raw : `#${raw}`
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : dflt
}

function slug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
