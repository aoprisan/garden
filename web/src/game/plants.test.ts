import { describe, it, expect } from 'vitest'
import { parsePlantsCsv } from './plants'

const HEADER = 'id,name,family,rarity,form,petal_color,leaf_color,growth_units,seed_yield,petal_yield,blurb'

describe('plants.csv', () => {
  it('reads a well-formed row', () => {
    const { species, warnings } = parsePlantsCsv(`${HEADER}\npoppy,Poppy,Papaver,uncommon,cup,#d7353a,#5f8b4a,200,2,12,Paper petals.`)
    expect(warnings).toEqual([])
    expect(species).toHaveLength(1)
    expect(species[0]).toMatchObject({
      id: 'poppy', name: 'Poppy', rarity: 'uncommon', form: 'cup', growthUnits: 200, seedYield: 2, petalYield: 12,
    })
  })

  it('honours a reordered header', () => {
    const { species } = parsePlantsCsv('name,id,growth_units\nPoppy,poppy,300\n')
    expect(species[0].name).toBe('Poppy')
    expect(species[0].growthUnits).toBe(300)
  })

  it('falls back (with a warning) on an unknown rarity or form', () => {
    const { species, warnings } = parsePlantsCsv(`${HEADER}\nx,X,F,legendary,hologram,#fff,#000,100,1,1,`)
    expect(species[0].rarity).toBe('common')
    expect(species[0].form).toBe('daisy')
    expect(warnings).toHaveLength(2)
  })

  it('skips duplicates and nameless rows', () => {
    const { species, warnings } = parsePlantsCsv(`${HEADER}\np,P,F,common,daisy,#fff,#000,100,1,1,\np,P2,F,common,daisy,#fff,#000,100,1,1,\n,,,,,,,,,,`)
    expect(species).toHaveLength(1)
    expect(warnings.some(w => w.includes('duplicate'))).toBe(true)
  })

  it('slugs an id and repairs a broken colour', () => {
    const { species } = parsePlantsCsv(`${HEADER}\nMorning Glory!,Morning Glory,Bindweed,common,vine,not-a-colour,#000,100,1,1,`)
    expect(species[0].id).toBe('morning-glory')
    expect(species[0].petalColor).toMatch(/^#/)
  })

  it('throws when nothing readable is left', () => {
    expect(() => parsePlantsCsv(HEADER)).toThrow(/no readable species/)
    expect(() => parsePlantsCsv('')).toThrow()
  })
})
