import { describe, it, expect } from 'vitest'
import { isReservedTag } from './builtin-tags'

// One predicate for "the app owns this tag, the user can't freely edit it".
// Union of built-in type tags + the reserved change-state tags, so every
// surface (Tags tab, Tag Manager, filter, store) asks the same question.
describe('isReservedTag', () => {
  it('covers built-in type tags', () => {
    expect(isReservedTag('Software System')).toBe(true)
    expect(isReservedTag('Person')).toBe(true)
    expect(isReservedTag('Relationship')).toBe(true)
  })

  it('covers the change-state tags', () => {
    expect(isReservedTag('New')).toBe(true)
    expect(isReservedTag('Modified')).toBe(true)
    expect(isReservedTag('Unchanged')).toBe(true)
    expect(isReservedTag('Removed')).toBe(true)
  })

  it('is false for ordinary user tags', () => {
    expect(isReservedTag('Critical')).toBe(false)
    expect(isReservedTag('Payments')).toBe(false)
  })
})
