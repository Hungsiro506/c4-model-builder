import { describe, it, expect } from 'vitest'
import type { Workspace } from '@/types/model'
import { canConnectElements, elementLevel } from './connectionValidation'
import { EXPAND_BOUNDARY_PREFIX } from '@/components/canvas/canvasBuilders'

/** Workspace: person dev + systems A, B (B has container b1 with component b1c). */
function ws(): Workspace {
  return {
    name: 'conn-validation',
    model: {
      people: [{ id: 'dev', type: 'person', name: 'Developer', tags: [], properties: {} }],
      softwareSystems: [
        { id: 'sysA', type: 'softwareSystem', name: 'A', tags: [], properties: {}, containers: [] },
        {
          id: 'sysB', type: 'softwareSystem', name: 'B', tags: [], properties: {},
          containers: [{
            id: 'b1', type: 'container', name: 'B1', tags: [], properties: {},
            components: [{ id: 'b1c', type: 'component', name: 'B1C', tags: [], properties: {} }],
          }],
        },
      ],
      relationships: [],
      groups: [],
    },
    views: {
      systemLandscapeViews: [], systemContextViews: [], containerViews: [], componentViews: [],
      configuration: { styles: { elements: [], relationships: [] } },
    },
  } as unknown as Workspace
}

describe('elementLevel', () => {
  it('places person/system at 0, container at 1, component at 2', () => {
    expect(elementLevel('person')).toBe(0)
    expect(elementLevel('softwareSystem')).toBe(0)
    expect(elementLevel('container')).toBe(1)
    expect(elementLevel('component')).toBe(2)
  })
})

describe('canConnectElements', () => {
  const w = ws()

  it('allows same-level connections (system↔system, person↔system)', () => {
    expect(canConnectElements(w, 'sysA', 'sysB')).toBe(true)
    expect(canConnectElements(w, 'dev', 'sysA')).toBe(true)
  })

  it('blocks cross-level (container↔system) — the UI-breaking case', () => {
    expect(canConnectElements(w, 'b1', 'sysA')).toBe(false)
    expect(canConnectElements(w, 'sysA', 'b1')).toBe(false)
  })

  it('blocks component↔container and component↔system', () => {
    expect(canConnectElements(w, 'b1c', 'b1')).toBe(false)
    expect(canConnectElements(w, 'b1c', 'sysA')).toBe(false)
  })

  it('strips the expand-boundary prefix before resolving the element', () => {
    // B expanded → its endpoint id is the wrapper boundary; it still resolves
    // to sysB (level 0) and may connect to another system.
    expect(canConnectElements(w, `${EXPAND_BOUNDARY_PREFIX}sysB`, 'sysA')).toBe(true)
    // But the wrapper (system, level 0) still can't connect to a container.
    expect(canConnectElements(w, `${EXPAND_BOUNDARY_PREFIX}sysB`, 'b1')).toBe(false)
  })

  it('rejects null endpoints and self-connections', () => {
    expect(canConnectElements(w, null, 'sysA')).toBe(false)
    expect(canConnectElements(w, 'sysA', undefined)).toBe(false)
    expect(canConnectElements(w, 'sysA', 'sysA')).toBe(false)
  })

  it('rejects unknown ids', () => {
    expect(canConnectElements(w, 'sysA', 'ghost')).toBe(false)
  })
})
