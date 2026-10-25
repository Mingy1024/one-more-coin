import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createGantryAssembly } from './gantry'

describe('gantry inside the cabinet', () => {
  it('keeps all support rails inside the glass chamber at each travel corner', () => {
    const gantry = createGantryAssembly()
    for (const x of [-1.28, 1.28]) {
      for (const z of [-0.94, 0.96]) {
        gantry.bridge.position.z = z
        gantry.carriage.position.set(x, 0, z)
        gantry.root.updateWorldMatrix(true, true)
        const bounds = new THREE.Box3().setFromObject(gantry.root)

        expect(bounds.min.x).toBeGreaterThanOrEqual(-1.91)
        expect(bounds.max.x).toBeLessThanOrEqual(1.91)
        expect(bounds.min.z).toBeGreaterThanOrEqual(-1.675)
        expect(bounds.max.z).toBeLessThanOrEqual(1.675)
      }
    }
  })
})
