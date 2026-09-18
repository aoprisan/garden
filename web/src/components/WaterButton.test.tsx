import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WaterButton from './WaterButton'

const base = {
  targetName: 'Marigold',
  unitsPerTend: 1,
  totalUnits: 120,
  meter: 1,
  blocked: false,
  multiplier: 1,
  gnome: false,
  idle: false,
}

describe('WaterButton', () => {
  it('tends on press and shows what a tend is worth', () => {
    const onTend = vi.fn()
    render(<WaterButton {...base} onTend={onTend} />)
    fireEvent.click(screen.getByRole('button', { name: /WATER/ }))
    expect(onTend).toHaveBeenCalledTimes(1)
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByText('Marigold')).toBeInTheDocument()
  })

  it('cannot be pressed with nothing growing', () => {
    const onTend = vi.fn()
    render(<WaterButton {...base} idle onTend={onTend} />)
    fireEvent.click(screen.getByRole('button', { name: /WATER/ }))
    expect(onTend).not.toHaveBeenCalled()
    expect(screen.getByText('no bed chosen')).toBeInTheDocument()
  })

  it('surfaces fertilizer, the gnome and a throttled tap', () => {
    render(<WaterButton {...base} multiplier={3} unitsPerTend={3} gnome blocked onTend={() => {}} />)
    expect(screen.getByText(/3×/)).toBeInTheDocument()
    expect(screen.getByText(/Easy/)).toBeInTheDocument()
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('offers Walk Mode only where steps can be counted', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<WaterButton {...base} onTend={() => {}} />)
    expect(screen.queryByText(/WALKING|GROW BY WALKING/)).toBeNull()

    rerender(
      <WaterButton
        {...base}
        onTend={() => {}}
        walk={{ active: true, steps: 42, activity: 'walking', onToggle }}
      />,
    )
    const toggle = screen.getByRole('button', { name: /WALKING/ })
    expect(toggle).toHaveTextContent('42')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalled()
  })
})
