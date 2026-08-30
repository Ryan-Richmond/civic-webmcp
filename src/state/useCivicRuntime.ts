import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { civicReducer, createInitialState, restorePersistentState, serializePersistentState } from './civicState'
import { registerCivicTools } from '../webmcp/tools'

const STORAGE_KEY = 'civic:state:hc-1.0'

function loadInitialState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? restorePersistentState(saved) : createInitialState()
  } catch {
    return createInitialState()
  }
}

export function useCivicRuntime() {
  const [state, dispatch] = useReducer(civicReducer, undefined, loadInitialState)
  const [webMcpStatus, setWebMcpStatus] = useState<'unavailable' | 'registering' | 'live' | 'error'>(
    document.modelContext ? 'registering' : 'unavailable',
  )
  const stateRef = useRef(state)
  stateRef.current = state
  const environment = useMemo(() => ({ getState: () => stateRef.current, dispatch }), [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializePersistentState(state))
    } catch {
      // Civic remains fully usable when storage is blocked or full.
    }
  }, [state.accepted, state.canonical, state.modelVersion])

  useEffect(() => {
    const modelContext = document.modelContext
    if (!modelContext) {
      setWebMcpStatus('unavailable')
      return
    }

    let current = true
    setWebMcpStatus('registering')
    const registration = registerCivicTools(modelContext, state, environment)
    void registration.ready.then(
      () => { if (current) setWebMcpStatus('live') },
      () => { if (current) setWebMcpStatus('error') },
    )
    return () => {
      current = false
      registration.controller.abort()
    }
  }, [environment, state.stateVersion])

  return { state, dispatch, webMcpStatus }
}
