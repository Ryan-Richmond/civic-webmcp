import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Sankey: () => null,
}))

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(document, 'modelContext')
})

describe('WebMCP runtime integration', () => {
  it('registers the baseline tools and makes WebMCP the primary live workspace', async () => {
    const registerTool = vi.fn((_tool: WebMCP.ModelContextTool, _options?: WebMCP.ModelContextRegisterToolOptions) => Promise.resolve())
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool } as unknown as WebMCP.ModelContext,
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('WebMCP live')).toBeInTheDocument())
    expect(registerTool).toHaveBeenCalledTimes(4)
    expect(screen.getByText(/4 registered/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Agent harness' })).not.toBeInTheDocument()
  })

  it('does not churn registrations when only the state version changes', async () => {
    const registered = new Map<string, WebMCP.ModelContextTool>()
    const registerTool = vi.fn((tool: WebMCP.ModelContextTool, options?: WebMCP.ModelContextRegisterToolOptions) => {
      registered.set(tool.name, tool)
      options?.signal?.addEventListener('abort', () => {
        if (registered.get(tool.name) === tool) registered.delete(tool.name)
      })
      return Promise.resolve()
    })
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool } as unknown as WebMCP.ModelContext,
    })

    render(<App />)
    await waitFor(() => expect(screen.getByText('WebMCP live')).toBeInTheDocument())
    expect(registerTool).toHaveBeenCalledTimes(4)

    await act(async () => {
      await registered.get('focus_tradeoffs')!.execute(
        { stateVersion: 1, programs: ['housing'] },
        { signal: new AbortController().signal },
      )
    })
    expect(registerTool).toHaveBeenCalledTimes(4)

    await act(async () => {
      await registered.get('preview_scenario')!.execute(
        { stateVersion: 2, name: 'Preview', weights: { stability: 1 }, rationale: 'Test registration lifecycle' },
        { signal: new AbortController().signal },
      )
    })
    await waitFor(() => expect(registered.has('revise_scenario')).toBe(true))
    expect(registerTool).toHaveBeenCalledTimes(7)

    await act(async () => {
      await registered.get('revise_scenario')!.execute(
        { stateVersion: 3, name: 'Revision', weights: { mobility: 1 }, rationale: 'Same tool surface' },
        { signal: new AbortController().signal },
      )
    })
    expect(registerTool).toHaveBeenCalledTimes(7)
  })

  it('labels tool definitions honestly and keeps the fallback harness when WebMCP is unavailable', () => {
    render(<App />)

    expect(screen.getByText('WebMCP unavailable')).toBeInTheDocument()
    expect(screen.getByText(/4 defined · WebMCP unavailable/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Agent harness' })).toBeInTheDocument()
  })
})
