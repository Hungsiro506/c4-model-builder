import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import BoundaryNode from './BoundaryNode'

interface BoundaryNodeData {
  name: string
  typeLabel: string
  empty?: boolean
  collapsible?: boolean
  elementId?: string
}

function renderBoundary(data: BoundaryNodeData) {
  return render(
    <ReactFlowProvider>
      <BoundaryNode
        id="test-boundary"
        type="boundary"
        data={data}
        selected={false}
        isConnectable={false}
        zIndex={-5}
        dragging={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>,
  )
}

describe('BoundaryNode "+" dropdown', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders "+" button for collapsible Software System boundary', () => {
    renderBoundary({
      name: 'My System',
      typeLabel: 'Software System',
      collapsible: true,
      elementId: 'sys1',
    })
    const btn = screen.getByRole('button', { name: /add container to my system/i })
    expect(btn).toBeTruthy()
  })

  it('opens dropdown with Container, Database, Component on "+" click for system', async () => {
    renderBoundary({
      name: 'My System',
      typeLabel: 'Software System',
      collapsible: true,
      elementId: 'sys1',
    })

    // Click "+" to open dropdown
    const plusBtn = screen.getByRole('button', { name: /add container to my system/i })
    await userEvent.click(plusBtn)

    // Dropdown items use "New X in Y" aria-labels
    expect(screen.getByRole('button', { name: /new container in my system/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /new database in my system/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /new component in my system/i })).toBeTruthy()
  })

  it('does not show Database in dropdown for Container boundary', async () => {
    renderBoundary({
      name: 'My Container',
      typeLabel: 'Container',
      collapsible: true,
      elementId: 'c1',
    })
    const btn = screen.getByRole('button', { name: /add component to my container/i })
    await userEvent.click(btn)

    // Container dropdown only has "Component" (via "New Component in...")
    expect(screen.getByRole('button', { name: /new component in my container/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /new database/i })).toBeFalsy()
    expect(screen.queryByRole('button', { name: /new container/i })).toBeFalsy()
  })

  it('clicking outside the dropdown closes it', async () => {
    renderBoundary({
      name: 'My System',
      typeLabel: 'Software System',
      collapsible: true,
      elementId: 'sys1',
    })

    // Open dropdown
    const btn = screen.getByRole('button', { name: /add container to my system/i })
    await userEvent.click(btn)
    expect(screen.getByRole('button', { name: /new database in my system/i })).toBeTruthy()

    // Click outside
    await userEvent.click(document.body)

    // Dropdown closed
    expect(screen.queryByRole('button', { name: /new database in my system/i })).toBeFalsy()
  })

  it('does not show "+" button when not collapsible', () => {
    renderBoundary({
      name: 'Read Only',
      typeLabel: 'Software System',
      collapsible: false,
    })
    expect(screen.queryByRole('button', { name: /add/i })).toBeFalsy()
  })
})
