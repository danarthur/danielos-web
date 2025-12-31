'use client'

import { useMemo } from 'react'
import ForceGraph3D from 'react-force-graph-3d'

type Link = { source: number; target: number }

export default function NeuralNetwork() {
  // 1. Generate Static Mock Data (prevents hydration mismatch)
  const data = useMemo(() => {
    const nodes = [...Array(50).keys()].map(i => ({
      id: i,
      name: `Node ${i}`,
      val: Math.random() * 20
    }))

    const links: Link[] = []
    nodes.forEach(node => {
      // Connect to 2-3 random other nodes
      const numConnections = Math.floor(Math.random() * 3) + 2
      for (let k = 0; k < numConnections; k++) {
        const target = Math.floor(Math.random() * nodes.length)
        if (target !== node.id) {
          links.push({ source: node.id, target: target })
        }
      }
    })
    return { nodes, links }
  }, [])

  return (
    <ForceGraph3D
      graphData={data}
      // FIX: Use explicit Hex instead of 'transparent'
      backgroundColor="#0a0a0a"
      // Aesthetic Config
      nodeColor={() => "#ededed"} // Primary Text Color
      linkColor={() => "#262626"} // Subtle Border Color
      nodeResolution={8}
      linkDirectionalParticles={2}
      linkDirectionalParticleSpeed={0.005}
      linkDirectionalParticleWidth={1}
      linkOpacity={0.3}
    />
  )
}
