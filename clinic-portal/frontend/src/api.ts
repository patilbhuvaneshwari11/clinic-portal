import toast from 'react-hot-toast'

const TOKEN_KEY = 'clinic_access_token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
export const removeToken = (): void => localStorage.removeItem(TOKEN_KEY)

let unauthorizedHandler: (() => void) | null = null
export const setUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOpts = Omit<RequestInit, 'body'> & {
  body?: unknown
  quiet?: boolean
}

export async function request(path: string, { body, quiet, headers, ...init }: RequestOpts = {}): Promise<Response> {
  const token = getToken()
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  const mergedHeaders = {
    ...defaultHeaders,
    ...(headers as Record<string, string>),
  }

  const url = path.startsWith('/api') ? path : `/api${path}`

  try {
    const res = await fetch(url, {
      ...init,
      headers: mergedHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (res.ok) {
      return res
    }

    // Parse error response
    let code = 'ERROR'
    let message = 'An unexpected error occurred.'

    try {
      const data = await res.json()
      if (typeof data.detail === 'string') {
        message = data.detail
      } else if (data.detail && typeof data.detail === 'object') {
        if (Array.isArray(data.detail)) {
          message = data.detail.map((e: { loc?: string[]; msg?: string }) => e.msg || 'Validation error').join(', ')
        } else {
          code = data.detail.code || code
          message = data.detail.message || message
        }
      } else if (data.message) {
        message = data.message
      }
    } catch {
      message = res.statusText || message
    }

    if (res.status === 401) {
      removeToken()
      if (unauthorizedHandler) {
        unauthorizedHandler()
      }
      if (!quiet) {
        toast.error('Session expired. Please log in again.')
      }
    } else if (!quiet) {
      toast.error(message)
    }

    throw new ApiError(res.status, code, message)
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    const msg = (err as Error).message || 'Network request failed'
    if (!quiet) {
      toast.error(msg)
    }
    throw new ApiError(0, 'NETWORK_ERROR', msg)
  }
}

export async function api<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const res = await request(path, opts)
  if (res.status === 204) {
    return undefined as unknown as T
  }
  return (await res.json()) as T
}

export async function downloadCsv(path: string, body: unknown, filename = 'export.csv') {
  const token = getToken()
  const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let msg = 'Failed to download file'
    try {
      const err = await res.json()
      msg = err.detail?.message || err.detail || msg
    } catch {}
    toast.error(msg)
    throw new Error(msg)
  }

  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
  toast.success('Export downloaded successfully!')
}

export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) {
      search.set(k, String(v))
    }
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}
