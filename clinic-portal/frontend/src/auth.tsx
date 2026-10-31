import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api, getToken, removeToken, setToken, setUnauthorizedHandler } from './api'
import type { AuthResponse, Role, User } from './types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string, role: Role) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>(null!)

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
    })

    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    api<User>('/auth/me', { quiet: true })
      .then((data) => {
        setUser(data)
      })
      .catch(() => {
        removeToken()
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = async (username: string, password: string, role: Role) => {
    const res = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { username, password, role },
    })
    setToken(res.access_token)
    setUser(res.user)
    toast.success(`Welcome back, ${res.user.full_name}!`)
  }

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', quiet: true })
    } catch {
      // Ignore error during logout
    } finally {
      removeToken()
      setUser(null)
      toast.success('Logged out successfully.')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
