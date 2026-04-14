"use client";

import React, { useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle, 
  Position,
  NodeProps,
  Edge,
  Node,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom Node Component
const AgentNode = ({ data }: NodeProps) => {
  return (
    <div className={`react-flow__node-agent ${data.active ? 'active' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 uppercase font-mono">{data.role}</span>
        <span className="text-lg font-bold">{data.label}</span>
        {data.status && (
          <span className="mt-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit">
            {data.status}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = {
  agent: AgentNode,
};

const initialNodes: Node[] = [
  {
    id: 'alnitak',
    type: 'agent',
    position: { x: 250, y: 50 },
    data: { label: 'Alnitak', role: 'Planner', active: false, status: '' },
  },
  {
    id: 'alnilam',
    type: 'agent',
    position: { x: 250, y: 250 },
    data: { label: 'Alnilam', role: 'Coder', active: false, status: '' },
  },
  {
    id: 'mintaka',
    type: 'agent',
    position: { x: 250, y: 450 },
    data: { label: 'Mintaka', role: 'QA', active: false, status: '' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'alnitak', target: 'alnilam', animated: false },
  { id: 'e2-3', source: 'alnilam', target: 'mintaka', animated: false },
  { id: 'e3-2', source: 'mintaka', target: 'alnilam', animated: false, label: 'Rejected', labelStyle: { fill: '#f87171', fontWeight: 700 } },
];

interface AgentCanvasProps {
  activeAgent?: string | null;
  replayEvent?: any;
}

const AgentCanvas: React.FC<AgentCanvasProps> = ({ activeAgent, replayEvent }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    if (activeAgent) {
      updateActiveAgent(activeAgent.toLowerCase());
    }
  }, [activeAgent]);

  useEffect(() => {
    if (replayEvent) {
      if (replayEvent.type === 'AGENT_ACTIVATED') {
        updateActiveAgent(replayEvent.agent.toLowerCase());
      } else if (replayEvent.type === 'STATUS_CHANGE') {
        // Optional: update status labels on nodes
      } else if (replayEvent.type === 'QA_REJECTED') {
        animateEdge('e3-2');
      }
    }
  }, [replayEvent]);

  const updateActiveAgent = (agentId: string) => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          active: node.id === agentId,
        },
      }))
    );

    // Animate relevant edges
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: edge.source === agentId || edge.target === agentId,
      }))
    );
  };

  const animateEdge = (edgeId: string) => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: edge.id === edgeId,
      }))
    );
    setTimeout(() => {
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          animated: false,
        }))
      );
    }, 2000);
  };

  return (
    <div className="w-full h-full bg-gray-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#1f2937" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default AgentCanvas;
