import { describe, it, expect, afterEach } from 'vitest'
import {
  BUILT_IN_SOURCE, activeConfig, applyConfig, buildConfig, configSummary, isCustomConfig,
  onConfigChange, resetConfig,
} from './config'
import { allDecor, allSpecies, getDecor, getSpecies, stageCount } from './catalog'

afterEach(() => resetConfig())

describe('the live config', () => {
  it('ships a playable built-in garden', () => {
    const config = buildConfig({})
    expect(config.custom).toEqual([])
    expect(config.species.length).toBeGreaterThan(5)
    expect(config.knobs.stages).toBe(10) // the design's ten visual stages
    const summary = configSummary(config)
    expect(summary.startingSeeds).toBeGreaterThan(0)
    expect(summary.cells).toBe(config.knobs.gardenWidth * config.knobs.gardenHeight)
  })

  it('every starting seed names a species that exists', () => {
    const config = buildConfig({})
    const ids = new Set(config.species.map(s => s.id))
    for (const id of Object.keys(config.knobs.startingSeeds)) expect(ids.has(id)).toBe(true)
    expect(config.warnings).toEqual([])
  })

  it('applies an uploaded plants file and rebuilds the catalog', () => {
    const seen: string[] = []
    const off = onConfigChange(c => seen.push(`${c.species.length} species`))
    applyConfig({ plantsCsv: 'id,name,growth_units\nhosta,Hosta,500\n' }, { persist: false })
    expect(allSpecies().map(s => s.id)).toEqual(['hosta'])
    expect(getSpecies('marigold')).toBeUndefined()
    expect(isCustomConfig()).toBe(true)
    expect(seen).toEqual(['1 species'])
    off()
  })

  it('applies tuning and the catalog picks up the new stage count', () => {
    applyConfig({ tuningCsv: 'key,value\ngarden.stages,4\n' }, { persist: false })
    expect(stageCount()).toBe(4)
    expect(activeConfig().knobs.stages).toBe(4)
  })

  it('rejects a plants file with no species and keeps the running config', () => {
    const before = allSpecies().length
    expect(() => applyConfig({ plantsCsv: 'id,name,growth_units\n' }, { persist: false })).toThrow(/no readable species/)
    expect(allSpecies()).toHaveLength(before)
    expect(isCustomConfig()).toBe(false)
  })

  it('treats a blank upload as "leave that file alone"', () => {
    applyConfig({ plantsCsv: '   \n' }, { persist: false })
    expect(activeConfig().source.plantsCsv).toBe(BUILT_IN_SOURCE.plantsCsv)
  })

  it('warns (but still runs) when a starting seed names nothing', () => {
    const config = buildConfig({
      plantsCsv: 'id,name,growth_units\nhosta,Hosta,500\n',
      tuningCsv: 'key,value\nstarting_seeds.marigold,3\n',
    })
    expect(config.warnings.some(w => w.includes('marigold'))).toBe(true)
    expect(config.species).toHaveLength(1)
  })

  it('reverts to the built-in files', () => {
    applyConfig({ plantsCsv: 'id,name,growth_units\nhosta,Hosta,500\n' }, { persist: false })
    resetConfig()
    expect(activeConfig().source.plantsCsv).toBe(BUILT_IN_SOURCE.plantsCsv)
    expect(isCustomConfig()).toBe(false)
  })

  it('ships a decor catalog, and keeps the garden playable without one', () => {
    const shipped = buildConfig({})
    expect(shipped.decor.length).toBeGreaterThan(0)
    expect(configSummary(shipped).decor).toBe(shipped.decor.length)

    // decor.csv is cosmetic, so an unreadable one costs you the ornaments and
    // nothing else — unlike plants.csv, which throws and keeps the old config.
    const broken = buildConfig({ decorCsv: 'id,name,kind,form\n' }) // a header and nothing under it
    expect(broken.species.length).toBeGreaterThan(0)
    expect(broken.decor).toEqual([])
    expect(broken.warnings.some(w => w.includes('decor.csv'))).toBe(true)
  })

  it('swaps the decor catalog at runtime, like the species one', () => {
    applyConfig({ decorCsv: 'id,name,kind,form,color,accent,petals,blurb\nobelisk,Obelisk,object,rock,#888,#444,9,\n' }, { persist: false })
    expect(allDecor().map(d => d.id)).toEqual(['obelisk'])
    expect(getDecor('bench')).toBeUndefined()
    expect(isCustomConfig()).toBe(true)
    resetConfig()
    expect(getDecor('bench')?.name).toBe('Garden bench')
  })
})
