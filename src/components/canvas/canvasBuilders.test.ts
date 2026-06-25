import { describe, expect, it } from 'vitest'
import { buildNodes } from './canvasBuilders'
import type { HighlightFilters } from '@/lib/highlight'
import { THEMES } from '@/lib/themes'
import type { ElementStyle, Workspace } from '@/types/model'

const NO_FILTERS: HighlightFilters = {
  tags: [],
  statuses: [],
  techs: [],
  teams: [],
}

function workspace(styles: ElementStyle[], tags = ['Element', 'Person']): Workspace {
  return {
    name: 'Theme test',
    model: {
      people: [
        { id: 'user', type: 'person', name: 'User', tags, properties: {} },
      ],
      softwareSystems: [],
      relationships: [],
      groups: [],
    },
    views: {
      systemLandscapeViews: [
        {
          type: 'systemLandscape',
          key: 'landscape',
          elements: [{ id: 'user' }],
          relationships: [],
        },
      ],
      systemContextViews: [],
      containerViews: [],
      componentViews: [],
      configuration: { styles: { elements: styles, relationships: [] } },
    },
  }
}

function personStyle(styles: ElementStyle[]) {
  return styles.find((style) => style.tag === 'Person')!
}

function renderedStyle(styles: ElementStyle[], theme = THEMES.structurizr, tags?: string[]) {
  const ws = workspace(styles, tags)
  const [node] = buildNodes(
    ws,
    ws.views.systemLandscapeViews[0],
    () => {},
    NO_FILTERS,
    new Map(),
    new Set(),
    theme,
  )
  return node.data.style as ElementStyle
}

describe('buildNodes theme styles', () => {
  it('lets the active theme replace legacy built-in styles copied from another app palette', () => {
    const style = renderedStyle([personStyle(THEMES.readability)])
    expect(style.background).toBe(personStyle(THEMES.structurizr).background)
    expect(style.stroke).toBe(personStyle(THEMES.structurizr).stroke)
  })

  it('lets the active theme replace bundled template tag colors', () => {
    const style = renderedStyle([
      { tag: 'Bank Staff', background: '#1e2832', color: '#94a3b8', stroke: '#475569' },
    ], THEMES.light, ['Element', 'Person', 'Bank Staff'])
    expect(style.background).toBe(personStyle(THEMES.light).background)
    expect(style.stroke).toBe(personStyle(THEMES.light).stroke)
  })

  it('preserves non-color fields from bundled template tag styles', () => {
    const style = renderedStyle([
      { tag: 'Database', background: '#1e1a40', color: '#c4b5fd', stroke: '#7c3aed', shape: 'Cylinder' },
    ], THEMES.light, ['Element', 'Person', 'Database'])
    expect(style.background).toBe(personStyle(THEMES.light).background)
    expect(style.shape).toBe('Cylinder')
  })

  it('keeps custom built-in type styles that are not one of the app palettes', () => {
    const customStyle: ElementStyle = { tag: 'Person', background: '#123456', color: '#ffffff', stroke: '#abcdef' }
    const style = renderedStyle([customStyle])
    expect(style.background).toBe('#123456')
    expect(style.stroke).toBe('#abcdef')
  })

  it('keeps custom tag styles above the active theme', () => {
    const vipStyle: ElementStyle = { tag: 'VIP', background: '#441155', color: '#ffeeff', stroke: '#dd77ff' }
    const style = renderedStyle([vipStyle], THEMES.structurizr, ['Element', 'Person', 'VIP'])
    expect(style.background).toBe('#441155')
    expect(style.stroke).toBe('#dd77ff')
  })
})
