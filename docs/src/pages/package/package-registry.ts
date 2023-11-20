import {readFile} from 'node:fs'

export const REGISTRY = {
  async: {
    readme: await import('@reatom/async/README.md'),
    pkg: await import('@reatom/async/package.json'),
  },
  timer: {
    readme: await import('@reatom/timer/README.md'),
    pkg: await import('@reatom/timer/package.json'),
  },
}
