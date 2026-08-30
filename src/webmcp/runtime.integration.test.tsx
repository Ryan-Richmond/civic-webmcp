import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

  it('labels tool definitions honestly and keeps the fallback harness when WebMCP is unavailable', () => {
    render(<App />)

    expect(screen.getByText('WebMCP unavailable')).toBeInTheDocument()
    expect(screen.getByText(/4 defined · WebMCP unavailable/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Agent harness' })).toBeInTheDocument()
  })
})
