import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import TableNode, { type TableNodeData } from './TableNode'
import { useWorkspaceStore } from '@/store/workspace'

describe('TableNode', () => {
  afterEach(() => {
    cleanup()
    useWorkspaceStore.getState().clearTableSelection()
  })

  function renderTable(data: TableNodeData) {
    return render(
      <ReactFlowProvider>
        <TableNode
          id="__table__db1__t1"
          type="table"
          data={data}
          selected={false}
          isConnectable={false}
          zIndex={0}
          dragging={false}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
        />
      </ReactFlowProvider>,
    )
  }

  it('renders table name in header', () => {
    renderTable({
      tableDef: { id: 't1', name: 'Users', columns: [] },
      containerId: 'db1',
    })
    expect(screen.getByText('Users')).toBeTruthy()
  })

  it('renders "Untitled" when table name is empty', () => {
    renderTable({
      tableDef: { id: 't1', name: '', columns: [] },
      containerId: 'db1',
    })
    expect(screen.getByText('Untitled')).toBeTruthy()
  })

  it('shows "(no columns)" when table has no columns', () => {
    renderTable({
      tableDef: { id: 't1', name: 'Empty', columns: [] },
      containerId: 'db1',
    })
    expect(screen.getByText('(no columns)')).toBeTruthy()
  })

  it('renders column names and types', () => {
    renderTable({
      tableDef: {
        id: 't1', name: 'Users',
        columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'name', type: 'varchar(255)' },
        ],
      },
      containerId: 'db1',
    })
    expect(screen.getByText('id')).toBeTruthy()
    expect(screen.getByText('name')).toBeTruthy()
    expect(screen.getByText('int')).toBeTruthy()
    expect(screen.getByText('varchar(255)')).toBeTruthy()
  })

  it('shows PK key icon for primary key columns', () => {
    renderTable({
      tableDef: {
        id: 't1', name: 'Users',
        columns: [{ name: 'id', type: 'int', isPrimaryKey: true }],
      },
      containerId: 'db1',
    })
    // The Key icon renders inside the PK indicator span
    const pkSpan = screen.getByTitle('Primary Key')
    expect(pkSpan).toBeTruthy()
    expect(pkSpan.querySelector('svg')).toBeTruthy()
  })

  it('shows nullable indicator N for nullable columns', () => {
    renderTable({
      tableDef: {
        id: 't1', name: 'Users',
        columns: [{ name: 'nickname', type: 'varchar', nullable: true }],
      },
      containerId: 'db1',
    })
    expect(screen.getByText('N')).toBeTruthy()
  })

  it('shows FK icon for foreign key columns', () => {
    renderTable({
      tableDef: {
        id: 't1', name: 'Users',
        columns: [{ name: 'org_id', type: 'int', foreignKey: 'orgs.id' }],
      },
      containerId: 'db1',
    })
    const fkSpan = screen.getByTitle('FK → orgs.id')
    expect(fkSpan).toBeTruthy()
    expect(fkSpan.querySelector('svg')).toBeTruthy()
  })

  it('calls selectTable on click', () => {
    renderTable({
      tableDef: { id: 't1', name: 'Users', columns: [] },
      containerId: 'db1',
    })
    const node = screen.getByText('Users').closest('.c4-node')!
    fireEvent.click(node)
    expect(useWorkspaceStore.getState().selectedTable).toEqual({ containerId: 'db1', tableId: 't1' })
  })

  it('applies selected class when this table is the selected one', () => {
    // Pre-select this table
    useWorkspaceStore.getState().selectTable('db1', 't1')
    render(
      <ReactFlowProvider>
        <TableNode
          id="__table__db1__t1"
          type="table"
          data={{ tableDef: { id: 't1', name: 'Users', columns: [] }, containerId: 'db1' }}
          selected={false}
          isConnectable={false}
          zIndex={0}
          dragging={false}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
        />
      </ReactFlowProvider>,
    )
    const node = document.querySelector('.c4-node')
    expect(node?.className).toContain('selected')
  })
})
