import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toBlob } from 'html-to-image'
import {
  selectExportNodeIds,
  selectExportEdgeIds,
  makeExportFilter,
  exportSelectedAsPng,
  copySelectedAsPng,
} from './exportSelectedPng'

vi.mock('html-to-image', () => ({
  toBlob: vi.fn(),
}))

// Minimal React-Flow-shaped node/edge stand-ins. Only the fields the export
// logic reads are present.
function node(id: string, type: string) {
  return { id, type, position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 60 } }
}
function edge(id: string, source: string, target: string) {
  return { id, source, target }
}

describe('selectExportNodeIds', () => {
  const nodes = [
    node('sys1', 'softwareSystem'),
    node('c1', 'container'),
    node('person1', 'person'),
    node('comp1', 'component'),
    node('__table__c1__t1', 'table'),
    node('group-a', 'group'),
    node('__scope_boundary__sys1', 'boundary'),
  ]

  it('keeps selected content nodes', () => {
    const ids = selectExportNodeIds(nodes, ['sys1', 'c1', 'person1'])
    expect([...ids].sort()).toEqual(['c1', 'person1', 'sys1'])
  })

  it('includes synthetic table nodes when selected', () => {
    const ids = selectExportNodeIds(nodes, ['__table__c1__t1'])
    expect(ids.has('__table__c1__t1')).toBe(true)
  })

  it('excludes boundary and group overlay nodes even if selected', () => {
    const ids = selectExportNodeIds(nodes, ['group-a', '__scope_boundary__sys1', 'sys1'])
    expect([...ids]).toEqual(['sys1'])
  })

  it('ignores selected ids that have no matching node', () => {
    const ids = selectExportNodeIds(nodes, ['ghost', 'sys1'])
    expect([...ids]).toEqual(['sys1'])
  })

  it('returns an empty set for an empty selection', () => {
    expect(selectExportNodeIds(nodes, []).size).toBe(0)
  })
})

describe('selectExportEdgeIds', () => {
  const edges = [
    edge('e1', 'sys1', 'c1'),
    edge('e2', 'c1', 'comp1'),
    edge('e3', 'sys1', 'outside'),
  ]

  it('keeps only edges whose both endpoints are in the node set', () => {
    const keep = new Set(['sys1', 'c1', 'comp1'])
    const ids = selectExportEdgeIds(edges, keep)
    expect([...ids].sort()).toEqual(['e1', 'e2'])
  })

  it('drops an edge with one endpoint outside the set', () => {
    const keep = new Set(['sys1', 'c1'])
    const ids = selectExportEdgeIds(edges, keep)
    expect(ids.has('e3')).toBe(false)
  })

  it('returns empty when the node set is empty', () => {
    expect(selectExportEdgeIds(edges, new Set()).size).toBe(0)
  })
})

describe('makeExportFilter', () => {
  const keepNodes = new Set(['sys1'])
  const keepEdges = new Set(['e1'])
  const filter = makeExportFilter(keepNodes, keepEdges)

  function el(className: string, dataId?: string) {
    const d = document.createElement('div')
    d.className = className
    if (dataId != null) d.setAttribute('data-id', dataId)
    return d
  }

  it('drops the dot-grid background layer', () => {
    expect(filter(el('react-flow__background'))).toBe(false)
  })

  it('drops minimap, controls, panel, and attribution chrome', () => {
    expect(filter(el('react-flow__minimap'))).toBe(false)
    expect(filter(el('react-flow__controls'))).toBe(false)
    expect(filter(el('react-flow__panel'))).toBe(false)
    expect(filter(el('react-flow__attribution'))).toBe(false)
  })

  it('keeps a selected node and drops an unselected node', () => {
    expect(filter(el('react-flow__node react-flow__node-default', 'sys1'))).toBe(true)
    expect(filter(el('react-flow__node', 'c1'))).toBe(false)
  })

  it('keeps a participating edge and drops a non-participating one', () => {
    expect(filter(el('react-flow__edge', 'e1'))).toBe(true)
    expect(filter(el('react-flow__edge', 'e2'))).toBe(false)
  })

  it('keeps/drops edge labels (separate layer) by their data-edge-id', () => {
    const keep = document.createElement('div')
    keep.setAttribute('data-edge-id', 'e1')
    const drop = document.createElement('div')
    drop.setAttribute('data-edge-id', 'e2')
    expect(filter(keep)).toBe(true)
    expect(filter(drop)).toBe(false)
  })

  it('keeps unrelated wrapper elements', () => {
    expect(filter(el('react-flow__viewport'))).toBe(true)
    expect(filter(el('some-inner-div'))).toBe(true)
  })
})

describe('exportSelectedAsPng', () => {
  beforeEach(() => {
    vi.mocked(toBlob).mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const nodes = [
    node('sys1', 'softwareSystem'),
    node('c1', 'container'),
    node('group-a', 'group'),
  ]
  const edges = [edge('e1', 'sys1', 'c1')]

  it('returns null when nothing exportable is selected', async () => {
    const viewport = document.createElement('div')
    const blob = await exportSelectedAsPng(viewport, nodes, edges, ['group-a'])
    expect(blob).toBeNull()
    expect(toBlob).not.toHaveBeenCalled()
  })

  it('renders the viewport transparent at 1x by default with 10px padding', async () => {
    const viewport = document.createElement('div')
    const expected = new Blob(['png'], { type: 'image/png' })
    vi.mocked(toBlob).mockResolvedValue(expected)

    const blob = await exportSelectedAsPng(viewport, nodes, edges, ['sys1', 'c1'])

    expect(blob).toBe(expected)
    expect(toBlob).toHaveBeenCalledOnce()
    const [target, opts] = vi.mocked(toBlob).mock.calls[0]
    expect(target).toBe(viewport)
    expect(opts?.backgroundColor).toBeUndefined()
    expect(opts?.pixelRatio).toBe(1)
    expect(typeof opts?.filter).toBe('function')
    // nodes are 100x60 at (0,0) → bbox 100x60, + 10px padding each side.
    expect(opts?.width).toBe(120)
    expect(opts?.height).toBe(80)
  })

  it('passes the chosen scale through as pixelRatio', async () => {
    const viewport = document.createElement('div')
    vi.mocked(toBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))

    await exportSelectedAsPng(viewport, nodes, edges, ['sys1', 'c1'], 3)

    expect(vi.mocked(toBlob).mock.calls[0][1]?.pixelRatio).toBe(3)
  })

  it('hides unkept edge paths during the snapshot and restores them after', async () => {
    // Build a viewport with the kept edge (e1) and a leaking one (e2).
    const viewport = document.createElement('div')
    const keepEdge = document.createElement('div')
    keepEdge.className = 'react-flow__edge'
    keepEdge.setAttribute('data-id', 'e1')
    const dropEdge = document.createElement('div')
    dropEdge.className = 'react-flow__edge'
    dropEdge.setAttribute('data-id', 'e2')
    viewport.append(keepEdge, dropEdge)

    // Capture display state at the moment of the snapshot.
    let keepDisplayDuring = ''
    let dropDisplayDuring = ''
    vi.mocked(toBlob).mockImplementation(async () => {
      keepDisplayDuring = keepEdge.style.display
      dropDisplayDuring = dropEdge.style.display
      return new Blob(['png'], { type: 'image/png' })
    })

    await exportSelectedAsPng(viewport, nodes, edges, ['sys1', 'c1'])

    expect(dropDisplayDuring).toBe('none') // leaking edge hidden while snapshotting
    expect(keepDisplayDuring).toBe('') // kept edge untouched
    expect(dropEdge.style.display).toBe('') // restored afterwards
  })

  it('multiplies the scale by devicePixelRatio so exports stay screen-crisp', async () => {
    const viewport = document.createElement('div')
    vi.mocked(toBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    const original = window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })

    await exportSelectedAsPng(viewport, nodes, edges, ['sys1', 'c1'], 2)

    // scale 2 × dpr 2 → pixelRatio 4
    expect(vi.mocked(toBlob).mock.calls[0][1]?.pixelRatio).toBe(4)
    Object.defineProperty(window, 'devicePixelRatio', { value: original, configurable: true })
  })
})

describe('copySelectedAsPng', () => {
  const nodes = [
    node('sys1', 'softwareSystem'),
    node('c1', 'container'),
    node('group-a', 'group'),
  ]
  const edges = [edge('e1', 'sys1', 'c1')]
  let writeMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(toBlob).mockReset()
    writeMock = vi.fn().mockResolvedValue(undefined)
    // jsdom ships neither ClipboardItem nor a writable clipboard.
    ;(globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem =
      vi.fn(function ClipboardItem(this: { items: unknown }, items: unknown) {
        this.items = items
      })
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeMock },
      configurable: true,
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false and skips the clipboard when nothing is exportable', async () => {
    const ok = await copySelectedAsPng(document.createElement('div'), nodes, edges, ['group-a'])
    expect(ok).toBe(false)
    expect(toBlob).not.toHaveBeenCalled()
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('writes a PNG ClipboardItem and returns true, honoring scale', async () => {
    vi.mocked(toBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))

    const ok = await copySelectedAsPng(document.createElement('div'), nodes, edges, ['sys1', 'c1'], 2)

    expect(ok).toBe(true)
    expect(vi.mocked(toBlob).mock.calls[0][1]?.pixelRatio).toBe(2)
    expect(writeMock).toHaveBeenCalledOnce()
    const ClipboardItemMock = (globalThis as unknown as { ClipboardItem: ReturnType<typeof vi.fn> }).ClipboardItem
    expect(ClipboardItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ 'image/png': expect.any(Blob) }),
    )
  })

  it('returns false when the snapshot yields no blob', async () => {
    vi.mocked(toBlob).mockResolvedValue(null)

    const ok = await copySelectedAsPng(document.createElement('div'), nodes, edges, ['sys1', 'c1'])

    expect(ok).toBe(false)
    expect(writeMock).not.toHaveBeenCalled()
  })
})
