import { describe, it, expect } from 'vitest'
import {
  CHANGE_STATES,
  CHANGESTATE_ELEMENT_STYLES,
  CHANGESTATE_RELATIONSHIP_STYLES,
  changeStateOf,
  withChangeState,
  type ChangeState,
} from '@/lib/changeState'

// Engine spec (TDD). Standard gap-analysis vocabulary + traffic-light colours.
// Render proof lives in the E2E specs.

describe('change constants', () => {
  it('exposes the four standard states in lifecycle order', () => {
    expect(CHANGE_STATES).toEqual<readonly ChangeState[]>(['New', 'Modified', 'Unchanged', 'Removed'])
  })

  it('element styles use the traffic-light fills + stroke + text (Removed dimmed)', () => {
    const byTag = Object.fromEntries(
      CHANGESTATE_ELEMENT_STYLES.map((s) => [s.tag, { background: s.background, stroke: s.stroke, color: s.color, opacity: s.opacity }]),
    )
    expect(byTag).toEqual({
      New: { background: '#2f8a40', stroke: '#57b86a', color: '#eafaec', opacity: undefined },
      Modified: { background: '#8a5e12', stroke: '#e0a83a', color: '#faf0dc', opacity: undefined },
      Unchanged: { background: '#3a4250', stroke: '#5b6472', color: '#d4dae3', opacity: undefined },
      Removed: { background: '#7a2e2e', stroke: '#c25555', color: '#fbe4e4', opacity: 65 },
    })
  })

  it('relationship styles use traffic-light line colours; Removed is dashed', () => {
    const byTag = Object.fromEntries(
      CHANGESTATE_RELATIONSHIP_STYLES.map((s) => [s.tag, { color: s.color, dashed: s.dashed }]),
    )
    expect(byTag).toEqual({
      New: { color: '#57b86a', dashed: undefined },
      Modified: { color: '#e0a83a', dashed: undefined },
      Unchanged: { color: '#6b7280', dashed: undefined },
      Removed: { color: '#c25555', dashed: true },
    })
  })
})

describe('changeStateOf', () => {
  it('reads the single change tag', () => {
    expect(changeStateOf(['Element', 'New'])).toBe('New')
    expect(changeStateOf(['Element', 'Software System'])).toBeUndefined()
  })

  it('resolves an ambiguous import (two states) to the last one — last-wins cascade', () => {
    expect(changeStateOf(['New', 'Removed'])).toBe('Removed')
  })
})

describe('withChangeState (mutual exclusion)', () => {
  it('sets a state, removing any prior change tag', () => {
    expect(withChangeState(['Element', 'Unchanged'], 'New')).toEqual(['Element', 'New'])
  })

  it('appends when none present (normal-tag behaviour, last in array)', () => {
    expect(withChangeState(['Element'], 'Modified')).toEqual(['Element', 'Modified'])
  })

  it('clears with undefined, leaving no residue', () => {
    expect(withChangeState(['Element', 'Removed'], undefined)).toEqual(['Element'])
  })

  it('does not duplicate when re-setting the same state', () => {
    expect(withChangeState(['New'], 'New')).toEqual(['New'])
  })

  it('collapses an ambiguous import to a single state', () => {
    expect(withChangeState(['New', 'Modified'], 'Unchanged')).toEqual(['Unchanged'])
  })
})
