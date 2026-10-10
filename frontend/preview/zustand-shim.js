// Mini-vervanger voor zustand, alleen voor de losse preview-build (zelfde API als `create`).
import { useSyncExternalStore } from 'react'

export function create(init) {
  let state
  const listeners = new Set()
  const get = () => state
  const set = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    if (next !== state) {
      state = { ...state, ...next }
      listeners.forEach((l) => l())
    }
  }
  const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))
  state = init(set, get)
  const useStore = (selector = (s) => s) => {
    const snap = useSyncExternalStore(subscribe, get)
    return selector(snap)
  }
  useStore.getState = get
  useStore.setState = set
  return useStore
}
