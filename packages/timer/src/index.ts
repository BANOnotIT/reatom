import {
  Action,
  action,
  Atom,
  atom,
  AtomMut,
  throwReatomError,
  __count,
} from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { noop, sleep } from '@reatom/utils'
import { getRootCause, onUpdate } from '@reatom/hooks'

export interface TimerAtom extends AtomMut<number> {
  /** (delay - remains) / delay */
  progressAtom: Atom<number>
  /** interval in ms */
  intervalAtom: AtomMut<number> & {
    /** @deprecated extra thing */
    setSeconds: Action<[seconds: number], number>
  }
  /** start timer by passed interval */
  startTimer: Action<[delay: number], Promise<void>>
  /** stop timer manually */
  stopTimer: Action<[], void>
  /** allow to pause timer */
  pauseAtom: AtomMut<boolean>
  /** switch pause state */
  pause: Action<[], boolean>
  /** track end of timer. Do not call manually! */
  endTimer: Action<[], void>
}

export const reatomTimer = (
  options:
    | string
    | {
        name?: string
        interval?: number
        delayMultiplier?: number
        progressPrecision?: number
        resetProgress?: boolean
      } = {},
): TimerAtom => {
  const {
    name = __count('timerAtom'),
    interval = 1000,
    delayMultiplier = 1000,
    progressPrecision = 2,
    resetProgress = true,
  } = typeof options === 'string' ? { name: options } : options
  const progressMultiplier = Math.pow(10, progressPrecision)
  const timerAtom = atom(0, `${name}Atom`)

  const progressAtom /* : TimerAtom['progressAtom'] */ = atom(
    0,
    `${name}.progressAtom`,
  )

  const pauseAtom: TimerAtom['pauseAtom'] = atom(false, `${name}.pauseAtom`)

  const intervalAtom: TimerAtom['intervalAtom'] = atom(
    interval,
    `${name}.intervalAtom`,
  ).pipe(
    withReducers({
      setSeconds: (state, seconds: number) => seconds * 1000,
    }),
  )

  const _versionAtom = atom(0, `${name}._versionAtom`)

  const startTimer: TimerAtom['startTimer'] = action((ctx, delay: number) => {
    delay *= delayMultiplier

    throwReatomError(delay < ctx.get(intervalAtom), 'delay less than interval')

    const version = _versionAtom(ctx, (s) => s + 1)
    const start = Date.now()
    let target = delay + start
    let remains = delay
    let pause = Promise.resolve()
    let resolvePause = noop

    timerAtom(ctx, remains)

    progressAtom(ctx, 0)

    pauseAtom(ctx, false)

    const cleanupPause = onUpdate(pauseAtom, (pauseCtx, value) =>
      getRootCause(ctx.cause) === getRootCause(pauseCtx.cause) &&
      pauseCtx.schedule(() => {
        if (value) {
          const from = Date.now()
          pause = new Promise((resolve) => {
            resolvePause = () => {
              target += Date.now() - from
              resolve()
            }
          })
        } else {
          resolvePause()
        }
      }),
    )

    return ctx
      .schedule(async () => {
        while (remains > 0) {
          await sleep(Math.min(remains, ctx.get(intervalAtom)))
          await pause

          if (version !== ctx.get(_versionAtom)) return

          const batch = ctx.get.bind(ctx)

          batch(() => {
            remains = timerAtom(ctx, Math.max(0, target - Date.now()))
            const interval = ctx.get(intervalAtom)
            const steps = Math.ceil(delay / interval)
            const stepsRemains = Math.ceil(remains / interval)
            progressAtom(
              ctx,
              +(1 - stepsRemains / steps).toFixed(progressPrecision),
            )
          })
        }

        endTimer(ctx)
      })
      .finally(cleanupPause)
  }, `${name}.startTimer`)

  const stopTimer: TimerAtom['stopTimer'] = action((ctx) => {
    _versionAtom(ctx, (s) => s + 1)
    endTimer(ctx)
    if (resetProgress) progressAtom(ctx, 0)
  }, `${name}.stopTimer`)

  const endTimer: TimerAtom['endTimer'] = action((ctx) => {
    timerAtom(ctx, 0)
  }, `${name}.endTimer`)

  const pause: TimerAtom['pause'] = action(
    (ctx) => pauseAtom(ctx, (s) => !s),
    `${name}.pause`,
  )

  return Object.assign(timerAtom, {
    progressAtom,
    endTimer,
    intervalAtom,
    startTimer,
    stopTimer,
    pauseAtom,
    pause,
  })
}
