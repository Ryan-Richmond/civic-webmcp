import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { civicReducer, createInitialState, restorePersistentState, serializePersistentState } from './civicState'
import { civicToolSurfaceKey, registerCivicTools } from '../webmcp/tools'

const STORAGE_KEY = 'civic:state:hc-1.0'

/**
 * Some hosts install `document.modelContext` after the page's own scripts run. Detecting it only at
 * mount would strand Civic on the fallback harness for the whole session, so poll briefly, then stop.
 */
const DETECT_INTERVAL_MS = 250
const DETECT_WINDOW_MS = 5000

function loadInitialState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? restorePersistentState(saved) : createInitialState()
  } catch {
    return createInitialState()
  }
}

function useModelContext(): WebMCP.ModelContext | null {
  const [modelContext, setModelContext] = useState<WebMCP.ModelContext | null>(() => document.modelContext ?? null)

  useEffect(() => {
    if (modelContext) return
    const deadline = Date.now() + DETECT_WINDOW_MS
    let timer = 0
    const poll = () => {
      const found = document.modelContext
      if (found) return setModelContext(found)
      if (Date.now() < deadline) timer = window.setTimeout(poll, DETECT_INTERVAL_MS)
    }
    timer = window.setTimeout(poll, DETECT_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [modelContext])

  return modelContext
}

export function useCivicRuntime() {
  const [state, dispatch] = useReducer(civicReducer, undefined, loadInitialState)
  const [coreReady, setCoreReady] = useState(false)
  const [dynamicReady, setDynamicReady] = useState(false)
  const [registrationError, setRegistrationError] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const environment = useMemo(() => ({ getState: () => stateRef.current, dispatch }), [])
  const modelContext = useModelContext()
  const toolSurfaceKey = civicToolSurfaceKey(state)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializePersistentState(state))
    } catch {
      // Civic remains fully usable when storage is blocked or full.
    }
  }, [state.accepted, state.canonical, state.modelVersion])

  useEffect(() => {
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
  }, [environment, modelContext])

  useEffect(() => {
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
  }, [environment, modelContext, toolSurfaceKey])

  const webMcpStatus: 'unavailable' | 'registering' | 'live' | 'error' = !modelContext
    ? 'unavailable'
    : registrationError
      ? 'error'
      : coreReady && dynamicReady
        ? 'live'
        : 'registering'

  return { state, dispatch, webMcpStatus }
}
