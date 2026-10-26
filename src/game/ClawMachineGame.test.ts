import { describe, expect, it, vi } from 'vitest'

import { ClawMachineGame, INITIAL_PRIZE_PLACEMENTS } from './ClawMachineGame'
import { clawHeadHeight } from './clawPose'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { canPickupPrize } from './prizeInteraction'
import { createRound, phaseProgress, stepRound, type RoundState } from './round'

describe('claw machine session', () => {
  it('does not advance a paid round while the title gallery is open', () => {
    const round = stepRound(createRound(), { type: 'START' })
    const render = vi.fn()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round,
      timer: { update: vi.fn(), getDelta: () => 2 },
      renderer: { render },
      scene: {},
      camera: {},
    }) as ClawMachineGame

    game.setPaused(true)
    ;(game as unknown as { update(): void }).update()

    expect((game as unknown as { round: RoundState }).round).toBe(round)
    expect(render).toHaveBeenCalledOnce()
  })

  it('starts with a reachable side-lying prize and other varied angles', () => {
    const rotations = INITIAL_PRIZE_PLACEMENTS.map((placement) => placement.rotation)
    expect(rotations.some((rotation) => Math.abs(rotation.z) > 0.6)).toBe(true)
    expect(rotations.filter((rotation) => Math.abs(rotation.y) > 0.1).length).toBeGreaterThanOrEqual(2)
    for (const placement of INITIAL_PRIZE_PLACEMENTS) {
      const { x, z } = placement.position
      const reachableX = Math.max(-1.28, Math.min(1.28, x))
      const reachableZ = Math.max(-0.94, Math.min(0.96, z))
      expect(canPickupPrize(placement.position, { x: reachableX, y: 0.6, z: reachableZ })).toBe(true)
    }
  })

  it('keeps every prize position, rotation and momentum when a new paid round begins', () => {
    const changedPosition = { x: 0.82, y: 0.61, z: 0.43 }
    const changedRotation = { x: 0, y: 0.22, z: 0, w: 0.975 }
    const body = {
      translation: () => changedPosition,
      rotation: () => changedRotation,
      setTranslation: vi.fn(),
      setRotation: vi.fn(),
      setLinvel: vi.fn(),
      setAngvel: vi.fn(),
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: createRound(),
      articulatedClaw: { reset: vi.fn() },
      prizes: [{
        body,
        carry: { release: vi.fn() },
      }],
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame

    game.restart()

    expect(body.translation()).toEqual(changedPosition)
    expect(body.rotation()).toEqual(changedRotation)
    expect(body.setTranslation).not.toHaveBeenCalled()
    expect(body.setRotation).not.toHaveBeenCalled()
    expect(body.setLinvel).not.toHaveBeenCalled()
    expect(body.setAngvel).not.toHaveBeenCalled()
  })

  it('restores every prize, including one already in the chute, without resetting the paid session', () => {
    const makePrize = (startX: number) => {
      const body = {
        setTranslation: vi.fn(),
        setRotation: vi.fn(),
        setLinvel: vi.fn(),
        setAngvel: vi.fn(),
      }
      return {
        start: { position: { x: startX, y: 0.5, z: -0.5 }, rotation: { x: 0, y: 0, z: 0.7, w: 0.71 } },
        body,
        mesh: { position: { set: vi.fn() }, quaternion: { set: vi.fn() } },
        carry: { release: vi.fn() },
      }
    }
    const prizes = [makePrize(-0.4), makePrize(0.8)]
    const round = createRound()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round,
      prizes,
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame

    game.resetPrizes()

    expect((game as unknown as { round: RoundState }).round).toBe(round)
    for (const prize of prizes) {
      expect(prize.carry.release).toHaveBeenCalledOnce()
      expect(prize.body.setTranslation).toHaveBeenCalledWith(prize.start.position, true)
      expect(prize.body.setRotation).toHaveBeenCalledWith(prize.start.rotation, true)
      expect(prize.body.setLinvel).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 }, true)
      expect(prize.body.setAngvel).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 }, true)
      expect(prize.mesh.position.set).toHaveBeenCalledWith(
        prize.start.position.x, prize.start.position.y, prize.start.position.z,
      )
    }
  })

  it('uses the current descent height for the second-stage close', () => {
    let round = stepRound(createRound(), { type: 'START' })
    round = stepRound(round, { type: 'GRAB' })
    round = stepRound(round, { type: 'TICK', deltaSeconds: 1.1 })
    const expectedHeight = clawHeadHeight('lowering', phaseProgress(round), MACHINE_DIMENSIONS.clawLowY)
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round,
      closingHeight: MACHINE_DIMENSIONS.clawLowY,
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame

    game.grab()

    const state = game as unknown as { round: RoundState; closingHeight: number }
    expect(state.round.phase).toBe('closing')
    expect(state.round.attempts).toBe(1)
    expect(state.closingHeight).toBeCloseTo(expectedHeight)
    expect(state.closingHeight).toBeGreaterThan(MACHINE_DIMENSIONS.clawLowY)
  })
})
