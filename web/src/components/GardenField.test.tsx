import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GardenField from './GardenField'
import { createGarden, newPlant } from '../game/garden'
import { resetConfig } from '../game/config'
import { stageCount } from '../game/catalog'

beforeEach(() => resetConfig())

describe('GardenField', () => {
  it('draws one hit target per bed and labels what is in it', () => {
    const garden = createGarden(3, 2)
    garden.cells[0].plant = newPlant('marigold', 0)
    garden.cells[0].plant!.stage = 4

    render(<GardenField garden={garden} pulseCell={null} onSelect={() => {}} />)
    expect(screen.getAllByRole('button', { name: /bed|Marigold/ })).toHaveLength(6) // one hit target per bed
    expect(screen.getByLabelText(`Marigold, stage 4 of ${stageCount()}`)).toBeInTheDocument()
    expect(screen.getByLabelText('empty bed 2, 1')).toBeInTheDocument()
  })

  it('selects a bed on tap', () => {
    const onSelect = vi.fn()
    const garden = createGarden(2, 2)
    render(<GardenField garden={garden} pulseCell={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('empty bed 2, 2'))
    expect(onSelect).toHaveBeenCalledWith(3)
  })

  it('spins the plot around its Y axis, by button and by arrow key', () => {
    const garden = createGarden(2, 2)
    const { container } = render(<GardenField garden={garden} pulseCell={null} onSelect={() => {}} />)
    const plane = container.querySelector('.field-plane') as HTMLElement
    const before = plane.style.transform
    expect(before).toMatch(/rotateX\(58deg\) rotateZ\(-20deg\)/)

    fireEvent.click(screen.getByTitle(/Rotate right/))
    expect(plane.style.transform).toMatch(/rotateZ\(25deg\)/)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(plane.style.transform).toMatch(/rotateZ\(10deg\)/)
  })

  it('marks the chosen bed and flashes the one that just grew', () => {
    const garden = createGarden(2, 2)
    garden.activeCell = 1
    const { container } = render(<GardenField garden={garden} pulseCell={2} onSelect={() => {}} />)
    expect(container.querySelectorAll('.cell.active')).toHaveLength(1)
    expect(container.querySelectorAll('.cell.pulse')).toHaveLength(1)
  })
})
