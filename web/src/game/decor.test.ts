import { describe, it, expect } from 'vitest'
import { parseDecorCsv, isFlatForm } from './decor'

const HEADER = 'id,name,kind,form,color,accent,petals,blurb'

describe('decor.csv', () => {
  it('reads a well-formed row', () => {
    const { decor, warnings } = parseDecorCsv(`${HEADER}\nbench,Garden bench,object,bench,#8a6a45,#5e472e,15,Somewhere to sit.`)
    expect(warnings).toEqual([])
    expect(decor).toHaveLength(1)
    expect(decor[0]).toMatchObject({
      id: 'bench', name: 'Garden bench', kind: 'object', form: 'bench', petals: 15,
    })
  })

  it('honours a reordered header', () => {
    const { decor } = parseDecorCsv('name,id,kind,petals\nGravel,gravel,ground,3\n')
    expect(decor[0]).toMatchObject({ id: 'gravel', kind: 'ground', petals: 3 })
  })

  it('falls back (with a warning) on an unknown kind or form', () => {
    const { decor, warnings } = parseDecorCsv(`${HEADER}\nx,X,statue,hologram,#fff,#000,5,`)
    expect(decor[0]).toMatchObject({ kind: 'object', form: 'rock' })
    expect(warnings).toHaveLength(2)
  })

  it('skips duplicates and nameless rows', () => {
    const { decor, warnings } = parseDecorCsv(`${HEADER}\np,P,ground,path,#fff,#000,1,\np,P2,ground,path,#fff,#000,1,\n,,,,,,,`)
    expect(decor).toHaveLength(1)
    expect(warnings).toHaveLength(2)
  })

  it('never gives an ornament away because the price column is blank', () => {
    const { decor } = parseDecorCsv(`${HEADER}\nplinth,Plinth,object,rock,#888,#444,,`)
    expect(decor[0].petals).toBe(5)
  })

  it('never throws — a garden with no ornaments is still a garden', () => {
    expect(parseDecorCsv('').decor).toEqual([])
    expect(parseDecorCsv('').warnings[0]).toMatch(/empty/)
    const junk = parseDecorCsv('nothing,useful,here\n')
    expect(junk.decor.length + junk.warnings.length).toBeGreaterThan(0)
  })

  it('knows which forms lie flat in the ground plane', () => {
    // A pond takes the whole cell like a bench does, but it is drawn flat —
    // which is a question about the form, not about the kind.
    expect(isFlatForm('water')).toBe(true)
    expect(isFlatForm('path')).toBe(true)
    expect(isFlatForm('bench')).toBe(false)
    expect(isFlatForm('pot')).toBe(false)
  })
})
