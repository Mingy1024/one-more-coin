import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { ClawMachineGame, INITIAL_PRIZE_PLACEMENTS, PRIZE_NAMES } from './ClawMachineGame'
import { clawHeadHeight } from './clawPose'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { canPickupPrize } from './prizeInteraction'
import { createRound, phaseProgress, stepRound, type RoundState } from './round'

describe('claw machine session', () => {
  it('moves the cabinet stick with the player input and returns it to centre', () => {
    const stick = new THREE.Group()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      machineStick: stick, movement: { x: 1, z: -1 },
      round: { ...createRound(), phase: 'aiming' },
    }) as ClawMachineGame
    const internals = game as unknown as { updateMachineControls(delta: number): void; movement: {x: number; z: number}; round: RoundState }
    for (let i = 0; i < 60; i++) internals.updateMachineControls(1 / 60)
    expect(stick.rotation.x).toBeCloseTo(-0.32 / Math.sqrt(2), 3)
    expect(stick.rotation.z).toBeCloseTo(-0.32 / Math.sqrt(2), 3)
    internals.round = { ...internals.round, phase: 'lowering' }
    for (let i = 0; i < 60; i++) internals.updateMachineControls(1 / 60)
    expect(stick.rotation.x).toBeCloseTo(0, 3)
    expect(stick.rotation.z).toBeCloseTo(0, 3)
  })
  it('recognizes an empty machine only after all six prizes are claimed and refills them on reset', () => {
    const prizes = Array.from({length: 6}, () => ({ claimed: true, mesh: {visible: false, position: {set: vi.fn()}, quaternion: {set: vi.fn()}},
      body: {setEnabled: vi.fn(), setTranslation: vi.fn(), setRotation: vi.fn(), setLinvel: vi.fn(), setAngvel: vi.fn()},
      carry: {release: vi.fn()}, collider: {setSensor: vi.fn()},
      start: {position: {x: 0,y: 0.6,z: 0}, rotation: {x: 0,y: 0,z: 0,w: 1}},
    }))
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      prizes, round: createRound(), publishSnapshot: vi.fn(),
    }) as ClawMachineGame
    expect(game.isMachineCleared()).toBe(true)
    game.resetPrizes()
    expect(game.isMachineCleared()).toBe(false)
    expect(prizes.every(prize => !prize.claimed && prize.mesh.visible)).toBe(true)
  })

  it('selects grip once when starting a challenge and preserves it for an early close', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.8)
    try {
      const game = Object.assign(Object.create(ClawMachineGame.prototype), {
        round: createRound(), timer: { reset: vi.fn() }, publishSnapshot: vi.fn(),
        closingHeight: 1.28,
      }) as ClawMachineGame
      const state = game as unknown as { round: RoundState; gripLevel: number }
      game.startRound()
      expect(state.gripLevel).toBe(0.92)
      game.startRound()
      state.round = { ...state.round, phase: 'lowering', phaseElapsed: 0.5 }
      game.grab()
      expect(state.gripLevel).toBe(0.92)
      expect(random).toHaveBeenCalledTimes(1)
      state.round = createRound()
      game.startRound()
      expect(state.gripLevel).toBe(0.76)
      expect(random).toHaveBeenCalledTimes(2)
    } finally {
      random.mockRestore()
    }
  })

  it('applies comparable return fatigue to front and rear prizes despite different travel times', () => {
    const finishReturn = (duration: number): number => {
      const game = Object.assign(Object.create(ClawMachineGame.prototype), {
        round: { ...createRound(), phase: 'returning', returnDuration: duration },
        carried: true,
        activePrize: { carry: { loosen: vi.fn(), getSupportError: () => 0 } },
        gripStrength: 0.9, gripQuality: 0.9, gripMass: 0.5,
        clawPosition: { x: 0, z: 0 },
        articulatedClaw: { getHeadPosition: () => ({ x: 0, y: 3.5, z: 0 }) },
        returnDisturbance: { peak: 0.47, strength: 0.9, direction: 0 },
      }) as ClawMachineGame
      const internals = game as unknown as { round: RoundState; gripStrength: number; advanceGrip(delta: number): void }
      const steps = Math.round(duration * 120)
      for (let frame = 0; frame < steps; frame += 1) {
        internals.round.phaseElapsed = duration * (frame + 0.5) / steps
        internals.advanceGrip(duration / steps)
      }
      return internals.gripStrength
    }
    expect(finishReturn(1.4)).toBeCloseTo(finishReturn(2.6), 4)
  })
  it('uses the final physical finger positions before deciding a pickup', () => {
    const calls: string[] = []
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'closing', phaseElapsed: 0.99 },
      timer: { update: vi.fn(), getDelta: () => 0.02 },
      driveVelocity: { x: 0, z: 0 },
      updateClawAnimation: (pickupFrame: boolean) => calls.push(`animate:${pickupFrame}`),
      updatePhysics: (_delta: number, forceStep: boolean) => calls.push(`physics:${forceStep}`),
      tryPickup: () => calls.push('pickup'),
      advanceGrip: vi.fn(), clearStaleChutePrizes: vi.fn(), checkForWin: vi.fn(),
      advancePrizeExit: vi.fn(), publishSnapshot: vi.fn(), renderFrame: vi.fn(),
    }) as ClawMachineGame

    ;(game as unknown as { update(): void }).update()

    expect(calls).toEqual(['animate:true', 'physics:true', 'pickup'])
  })

  it('captures the doll actually supported by the fingers when the initial target has shifted', () => {
    const makePrize = (x: number) => ({
      claimed: false,
      body: { translation: () => ({ x, y: 0.62, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) },
      carry: { capture: vi.fn() },
    })
    const initialTarget = makePrize(0.7)
    const contactedPrize = makePrize(0)
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      prizes: [initialTarget, contactedPrize], activePrize: initialTarget, gripLevel: 1,
      articulatedClaw: {
        getGrabPose: () => ({ x: 0, y: 0.46, z: 0 }),
        getFingerTipPositions: () => [
          { x: 0.34, y: 0.34, z: 0 },
          { x: -0.17, y: 0.34, z: 0.294 },
          { x: -0.17, y: 0.34, z: -0.294 },
        ],
        holdCurrentGrip: vi.fn(),
      },
    }) as ClawMachineGame

    ;(game as unknown as { tryPickup(): void }).tryPickup()

    expect(initialTarget.carry.capture).not.toHaveBeenCalled()
    expect(contactedPrize.carry.capture).toHaveBeenCalledOnce()
    expect((game as unknown as { activePrize: unknown }).activePrize).toBe(contactedPrize)
    const state = game as unknown as { gripLevel: number; gripStrength: number; tryPickup(): void }
    const strongest = state.gripStrength
    state.gripLevel = 0.76
    state.tryPickup()
    expect(state.gripStrength).toBeCloseTo(strongest * 0.76)
  })

  it('runs fixed physics steps across different display refresh rates', () => {
    const step = vi.fn()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: createRound(), world: { step, timestep: 0 }, prizes: [],
      articulatedClaw: { stabilizeSwing: vi.fn(), updateVisuals: vi.fn() },
    }) as ClawMachineGame
    const updatePhysics = (delta: number, forceStep = false) =>
      (game as unknown as { updatePhysics(delta: number, forceStep: boolean): void }).updatePhysics(delta, forceStep)

    updatePhysics(1 / 60)
    expect(step).toHaveBeenCalledTimes(2)
    expect((game as unknown as { world: { timestep: number } }).world.timestep).toBeCloseTo(1 / 120)
    updatePhysics(1 / 240)
    expect(step).toHaveBeenCalledTimes(2)
    updatePhysics(1 / 240)
    expect(step).toHaveBeenCalledTimes(3)
    updatePhysics(1 / 240, true)
    expect(step).toHaveBeenCalledTimes(4)
  })

  it('notifies the loading screen only after a frame has rendered', () => {
    const events: string[] = []
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: createRound(),
      timer: { update: vi.fn(), getDelta: () => 0 },
      renderer: { render: () => events.push('render') },
      scene: {}, camera: {},
    }) as ClawMachineGame

    game.setPaused(true)
    game.onNextRenderedFrame(() => events.push('ready'))
    expect(events).toEqual([])

    ;(game as unknown as { update(): void }).update()
    expect(events).toEqual(['render', 'ready'])

    ;(game as unknown as { update(): void }).update()
    expect(events).toEqual(['render', 'ready'])
  })

  it('releases a weak grip into a physical fall without awarding a win', () => {
    const prize = {
      carry: { loosen: vi.fn(), release: vi.fn(), getSupportError: () => 0 },
      body: { setLinvel: vi.fn(), setAngvel: vi.fn(), setTranslation: vi.fn() },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'returning', phaseElapsed: 0.7 },
      carried: true, activePrize: prize, lastGrabSucceeded: true,
      gripStrength: 0.181, gripQuality: 0.56, gripMass: 0.8,
      cycleStart: { x: 0.8, z: -0.2 }, clawPosition: { x: -0.2, z: 0.38 },
      articulatedClaw: { getHeadPosition: () => ({ x: 0, y: 3.5, z: 0.5 }), getHeadVelocity: () => ({ x: 0, y: 0, z: 0 }), releaseGrip: vi.fn() },
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame
    const internals = game as unknown as { advanceGrip(delta: number): void; carried: boolean; slipped: boolean; round: RoundState }
    internals.advanceGrip(0.05)
    expect(internals.carried).toBe(false)
    expect(internals.slipped).toBe(true)
    expect(internals.round.phase).toBe('returning')
    expect(prize.carry.release).toHaveBeenCalledOnce()
    expect(prize.body.setLinvel).toHaveBeenCalledOnce()
    expect(prize.body.setTranslation).not.toHaveBeenCalled()
  })

  it('can award a late slip that actually falls into the chute during the return', () => {
    const prize = {
      claimed: false, body: { translation: () => ({ x: -1.2, y: -0.72, z: 0.96 }) },
      collider: { setSensor: vi.fn() },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'returning' }, carried: false, slipped: true,
      activePrize: prize, publishSnapshot: vi.fn(),
    }) as ClawMachineGame
    ;(game as unknown as { checkForWin(): void }).checkForWin()
    expect(prize.claimed).toBe(true)
    expect((game as unknown as { round: RoundState }).round.phase).toBe('won')
  })

  it('does not award the next round for a still-falling doll from the previous one', () => {
    const prize = {
      claimed: false,
      body: { translation: () => ({ x: -1.2, y: -0.72, z: 0.96 }), setEnabled: vi.fn() },
      collider: { setSensor: vi.fn() },
      carry: { release: vi.fn() },
      mesh: { visible: true },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'releasing' },
      carried: false,
      activePrize: prize,
      prizes: [prize],
      stalePrizes: new Set([prize]),
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame
    const internals = game as unknown as { checkForWin(): void; clearStaleChutePrizes(): void; round: RoundState }

    internals.checkForWin()
    expect(internals.round.phase).toBe('releasing')
    internals.clearStaleChutePrizes()
    expect(prize.claimed).toBe(true)
    expect(prize.mesh.visible).toBe(false)
    expect(prize.body.setEnabled).toHaveBeenCalledWith(false)
    expect(internals.round.phase).toBe('releasing')
  })

  it('retires a still-carried doll when restarting and clears it if it later reaches the chute', () => {
    let position = { x: -1.2, y: 2.2, z: 0.96 }
    const prize = {
      claimed: false,
      body: {
        translation: () => position,
        linvel: () => ({ x: 0, y: -1, z: 0 }),
        setEnabled: vi.fn(),
      },
      carry: { release: vi.fn() },
      mesh: { visible: true },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'lost' },
      carried: true, activePrize: prize, prizes: [prize],
      articulatedClaw: { reset: vi.fn() },
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame
    const internals = game as unknown as { stalePrizes: Set<typeof prize>; clearStaleChutePrizes(): void }

    game.restart()
    expect(prize.carry.release).toHaveBeenCalled()
    expect(internals.stalePrizes.has(prize)).toBe(true)

    position = { x: -1.2, y: -0.72, z: 0.96 }
    internals.clearStaleChutePrizes()
    expect(prize.claimed).toBe(true)
    expect(prize.mesh.visible).toBe(false)
    expect(prize.body.setEnabled).toHaveBeenCalledWith(false)
    expect(internals.stalePrizes.has(prize)).toBe(false)
  })

  it('does not advance a paid round while the title gallery is open', () => {
    const round = stepRound(createRound(), { type: 'START' })
    const render = vi.fn()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round,
      timer: { update: vi.fn(), getDelta: () => 2 },
      renderer: { render },
      scene: {},
      camera: {},
      frameCallbacks: [],
    }) as ClawMachineGame

    game.setPaused(true)
    ;(game as unknown as { update(): void }).update()

    expect((game as unknown as { round: RoundState }).round).toBe(round)
    expect(render).not.toHaveBeenCalled()
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
        setEnabled: vi.fn(),
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

  it('clears a won doll after it falls into the chute, without clearing the other dolls', () => {
    let prizeY = -0.7
    const prize = {
      claimed: false,
      body: {
        translation: () => ({ x: -1.2, y: prizeY, z: 0.96 }),
        setEnabled: vi.fn(),
      },
      collider: { setSensor: vi.fn() },
      mesh: { visible: true },
    }
    const otherPrize = { mesh: { visible: true }, body: { setEnabled: vi.fn() } }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'releasing' },
      activePrize: prize,
      prizes: [prize, otherPrize],
      carried: false,
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame
    const internals = game as unknown as {
      checkForWin(): void
      advancePrizeExit(delta: number): void
    }

    internals.checkForWin()
    expect(prize.claimed).toBe(true)
    expect(prize.mesh.visible).toBe(true)
    expect(prize.body.setEnabled).not.toHaveBeenCalled()

    internals.advancePrizeExit(0.2)
    expect(prize.mesh.visible).toBe(true)
    prizeY = -1.1
    internals.advancePrizeExit(0.1)
    expect(prize.mesh.visible).toBe(false)
    expect(prize.body.setEnabled).toHaveBeenCalledWith(false)
    expect(otherPrize.mesh.visible).toBe(true)
    expect(otherPrize.body.setEnabled).not.toHaveBeenCalled()
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

  it('names all six dolls and excludes already won prizes from the clerk choices', () => {
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      prizes: [{ claimed: false }, { claimed: true }, { claimed: false }, { claimed: false }, { claimed: false }, { claimed: false }],
    }) as ClawMachineGame

    expect(PRIZE_NAMES).toHaveLength(6)
    expect(game.availablePrizesForClerk()).toEqual([
      { index: 0, name: '哆啦A夢' },
      { index: 2, name: '史努比' },
      { index: 3, name: '呆呆獸' },
      { index: 4, name: '妙蛙種子' },
      { index: 5, name: '三眼怪' },
    ])
  })

  it('uses a free spot near the chute when no doll is already there', () => {
    const selected = {
      claimed: false,
      body: {
        translation: () => ({ x: 1, y: 0.6, z: -0.8 }),
        setTranslation: vi.fn(), setRotation: vi.fn(), setLinvel: vi.fn(), setAngvel: vi.fn(),
      },
      mesh: { position: { set: vi.fn() }, quaternion: { set: vi.fn() } },
      carry: { release: vi.fn() },
    }
    const neighbor = {
      claimed: false,
      body: { translation: () => ({ x: 1, y: 0.6, z: -0.8 }), setTranslation: vi.fn() },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'lost' },
      prizes: [selected, neighbor],
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame

    expect(game.placePrizeForClerk(0)).toEqual({ type: 'placed' })
    expect(selected.body.setTranslation).toHaveBeenCalledOnce()
    expect(neighbor.body.setTranslation).not.toHaveBeenCalled()
    const position = selected.body.setTranslation.mock.calls[0]?.[0] as { x: number; y: number; z: number }
    expect(position.x).toBeGreaterThan(-0.3)
    expect(position.y).toBeCloseTo(0.62)
    expect(Math.hypot(position.x - 1, position.z + 0.8)).toBeGreaterThan(0.7)
  })

  it('swaps complete poses with an existing doll near the chute', () => {
    const makePrize = (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number; w: number }) => ({
      claimed: false,
      body: {
        translation: () => position, rotation: () => rotation,
        setTranslation: vi.fn(), setRotation: vi.fn(), setLinvel: vi.fn(), setAngvel: vi.fn(),
      },
      mesh: { position: { set: vi.fn() }, quaternion: { set: vi.fn() } },
      carry: { release: vi.fn() },
    })
    const far = makePrize({ x: 1.1, y: 0.6, z: -1 }, { x: 0, y: 0, z: 0, w: 1 })
    const near = makePrize({ x: -0.08, y: 0.6, z: 0.53 }, { x: 0, y: 0.3, z: 0, w: 0.954 })
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'lost' },
      prizes: [far, near],
    }) as ClawMachineGame

    expect(game.placePrizeForClerk(0)).toEqual({ type: 'swapped', displaced: '風速狗' })
    expect(far.body.setTranslation).toHaveBeenCalledWith({ x: -0.08, y: 0.6, z: 0.53 }, true)
    expect(near.body.setTranslation).toHaveBeenCalledWith({ x: 1.1, y: 0.6, z: -1 }, true)
    expect(far.body.setRotation).toHaveBeenCalledWith({ x: 0, y: 0.3, z: 0, w: 0.954 }, true)
    expect(near.body.setRotation).toHaveBeenCalledWith({ x: 0, y: 0, z: 0, w: 1 }, true)
  })

  it('lets the clerk rescue only the released doll genuinely stuck at the chute', () => {
    const prize = {
      claimed: false,
      body: { translation: () => ({ x: -1.2, y: 0.25, z: 0.96 }), linvel: () => ({ x: 0, y: 0, z: 0 }), setLinvel: vi.fn(), setAngvel: vi.fn(), setEnabled: vi.fn() },
      carry: { release: vi.fn() },
      collider: { setSensor: vi.fn() },
      mesh: { visible: true },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'lost' },
      prizes: [prize], activePrize: prize, lastGrabSucceeded: true,
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame

    expect(game.rescueStuckPrizeForClerk()).toBe('哆啦A夢')
    expect(prize.claimed).toBe(true)
    expect((game as unknown as { round: RoundState }).round.phase).toBe('won')
    expect(game.rescueStuckPrizeForClerk()).toBeUndefined()
  })

  it('rescues a successfully grabbed doll genuinely stuck on the claw after the round', () => {
    const prize = {
      claimed: false,
      body: { translation: () => ({ x: -1.15, y: 2.65, z: 0.95 }), linvel: () => ({ x: 0, y: 0, z: 0 }), setLinvel: vi.fn(), setAngvel: vi.fn(), setEnabled: vi.fn() },
      carry: { release: vi.fn() }, collider: { setSensor: vi.fn() }, mesh: { visible: true },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'lost' }, prizes: [prize], activePrize: prize, lastGrabSucceeded: true,
      articulatedClaw: { getGrabPosition: () => ({ x: -1.2, y: 2.7, z: 0.96 }), releaseGrip: vi.fn() },
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame
    expect(game.rescueStuckPrizeForClerk()).toBe('哆啦A夢')
    expect(prize.claimed).toBe(true)
    expect(game.rescueStuckPrizeForClerk()).toBeUndefined()
  })

  it('rejects clerk rescue when the doll merely lies near the chute without a successful grab', () => {
    const prize = {
      claimed: false,
      body: { translation: () => ({ x: -1.2, y: 0.25, z: 0.96 }), linvel: () => ({ x: 0, y: 0, z: 0 }) },
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: { ...createRound(), phase: 'lost' }, prizes: [prize], activePrize: prize,
      lastGrabSucceeded: false,
    }) as ClawMachineGame

    expect(game.rescueStuckPrizeForClerk()).toBeUndefined()
  })
})
