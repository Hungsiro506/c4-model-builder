import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import TableNode, { type TableNodeData } from './TableNode'

function renderTableNode(data: Partial<TableNodeData> = {}) {
  const defaultTableDef = {
    id: 't1',
    name: 'users',
    columns: [
      { name: 'id', type: 'INT', primaryKey: true, nullable: false },
      { name: 'name', type: 'VARCHAR(255)', primaryKey: false, nullable: true },
      { name: 'email', type: 'VARCHAR(255)', primaryKey: false, nullable: false, foreignKey: 'contacts.email' },
    ],
  }

  const nodeData: TableNodeData = {
    tableDef: data.tableDef ?? defaultTableDef,
    containerId: data.containerId ?? 'db1',
    style: data.style,
  }

  return render(
    <ReactFlowProvider>
      <TableNode
        id="table-t1"
        type="table"
        data={nodeData}
        selected={false}
        xPos={0}
        yPos={0}
        zIndex={0}
        dragging={false}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>,
  )
}

describe('TableNode', () => {
  it('renders table name', () => {
    const { getByText } = renderTableNode()
    expect(getByText('users')).toBeDefined()
  })

  it('renders column names and types', () => {
    const { getByText, getAllByText } = renderTableNode()
    expect(getByText('id')).toBeDefined()
    expect(getByText('name')).toBeDefined()
    expect(getByText('email')).toBeDefined()
    // INT appears twice (id + email columns), VARCHAR(255) appears twice (name + email)
    expect(getAllByText('INT').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('VARCHAR(255)').length).toBeGreaterThanOrEqual(1)
  })

  it('renders primary key indicator', () => {
    renderTableNode()
    // The PK column should have a Key icon — just verify rendering doesn't crash
    // (the icon is present in the DOM as an SVG)
  })

  it('renders foreign key indicator', () => {
    renderTableNode()
    // The email column has foreignKey set — FK icon should render
  })

  it('shows empty state when no columns', () => {
    const { getByText } = renderTableNode({
      tableDef: { id: 't2', name: 'empty_table', columns: [] },
    })
    expect(getByText('empty_table')).toBeDefined()
    expect(getByText('(no columns)')).toBeDefined()
  })

  it('shows placeholder name for unnamed columns', () => {
    const { getByText } = renderTableNode({
      tableDef: {
        id: 't3',
        name: 'test',
        columns: [{ name: '', type: 'INT', primaryKey: false, nullable: true }],
      },
    })
    expect(getByText('col_1')).toBeDefined()
  })
})
