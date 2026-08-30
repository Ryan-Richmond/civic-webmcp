import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { civicReducer, createInitialState, restorePersistentState, serializePersistentState } from './civicState'
import { civicToolSurfaceKey, registerCivicTools } from '../webmcp/tools'

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
  const [coreReady, setCoreReady] = useState(false)
  const [dynamicReady, setDynamicReady] = useState(false)
  const [registrationError, setRegistrationError] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const environment = useMemo(() => ({ getState: () => stateRef.current, dispatch }), [])
  const toolSurfaceKey = civicToolSurfaceKey(state)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializePersistentState(state))
    } catch {
      // Civic remains fully usable when storage is blocked or full.
    }
  }, [state.accepted, state.canonical, state.modelVersion])

  useEffect(() => {
    const modelContext = document.modelContext
    if (!modelContext) return

    let current = true
    setCoreReady(false)
    const registration = registerCivicTools(modelContext, stateRef.current, environment, 'core')
    void registration.ready.then(
      () => { if (current) setCoreReady(true) },
      () => { if (current) setRegistrationError(true) },
    )
    return () => {
      current = false
      registration.controller.abort()
    }
  }, [environment])

  useEffect(() => {
    const modelContext = document.modelContext
    if (!modelContext) return

    let current = true
    setDynamicReady(false)
    const registration = registerCivicTools(modelContext, stateRef.current, environment, 'dynamic')
    void registration.ready.then(
      () => { if (current) setDynamicReady(true) },
      () => { if (current) setRegistrationError(true) },
    )
    return () => {
      current = false
      registration.controller.abort()
    }
  }, [environment, toolSurfaceKey])

  const webMcpStatus: 'unavailable' | 'registering' | 'live' | 'error' = !document.modelContext
    ? 'unavailable'
    : registrationError
      ? 'error'
      : coreReady && dynamicReady
        ? 'live'
        : 'registering'

  return { state, dispatch, webMcpStatus }
}
