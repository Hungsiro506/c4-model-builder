import type { NodeTypes } from '@xyflow/react'
import PersonNode from './PersonNode'
import SystemNode from './SystemNode'
import ContainerNode from './ContainerNode'
import ComponentNode from './ComponentNode'
import GroupNode from './GroupNode'
import BoundaryNode from './BoundaryNode'
import TableNode from './TableNode'

export type { C4NodeData } from './types'
export type { TableNodeData } from './TableNode'

export const nodeTypes: NodeTypes = {
  person: PersonNode,
  softwareSystem: SystemNode,
  container: ContainerNode,
  component: ComponentNode,
  table: TableNode,
  group: GroupNode,
  boundary: BoundaryNode,
}
