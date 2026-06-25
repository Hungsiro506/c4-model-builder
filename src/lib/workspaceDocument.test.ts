import { describe, expect, it } from 'vitest'
import { parseWorkspaceDocument } from './workspaceDocument'

const BASIC_DSL = `
workspace {
  model {
    user = person "User"
  }
  views {
    systemLandscape "Landscape" {
      include *
    }
  }
}
`

describe('parseWorkspaceDocument', () => {
  it('uses the fallback name when the DSL workspace has no name', () => {
    const { workspace, errors } = parseWorkspaceDocument({
      content: BASIC_DSL,
      fallbackName: 'imported-workspace',
    })

    expect(errors).toEqual([])
    expect(workspace.name).toBe('imported-workspace')
  })

  it('applies valid sidecar data after parsing DSL', () => {
    const { workspace } = parseWorkspaceDocument({
      content: BASIC_DSL,
      sidecarJson: JSON.stringify({
        version: 1,
        elements: {
          user: { status: 'Deprecated', owner: 'Platform Team' },
        },
      }),
    })

    expect(workspace.model.people[0]).toMatchObject({
      id: 'user',
      status: 'Deprecated',
      owner: 'Platform Team',
    })
  })

  it('ignores invalid sidecar JSON and still returns the parsed workspace', () => {
    const { workspace } = parseWorkspaceDocument({
      content: BASIC_DSL,
      sidecarJson: JSON.stringify({ version: 2 }),
    })

    expect(workspace.model.people[0].id).toBe('user')
    expect(workspace.model.people[0].status).toBeUndefined()
  })

  it('returns tableData from sidecar when present', () => {
    const { workspace, tableData } = parseWorkspaceDocument({
      content: BASIC_DSL,
      sidecarJson: JSON.stringify({
        version: 1,
        tables: {
          'db-1': [
            { id: 't1', name: 'users', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
          ],
        },
      }),
    })

    expect(workspace.model.people[0].id).toBe('user')
    expect(tableData).toEqual({
      'db-1': [
        { id: 't1', name: 'users', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      ],
    })
  })

  it('returns empty tableData when sidecar has no tables', () => {
    const { tableData } = parseWorkspaceDocument({
      content: BASIC_DSL,
      sidecarJson: JSON.stringify({ version: 1 }),
    })

    expect(tableData).toEqual({})
  })

  it('returns empty tableData when no sidecar is provided', () => {
    const { tableData } = parseWorkspaceDocument({
      content: BASIC_DSL,
    })

    expect(tableData).toEqual({})
  })
})
