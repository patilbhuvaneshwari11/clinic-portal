import React, { useState } from 'react'
import { Eye, EyeOff, Lock, LogIn, ShieldAlert, Stethoscope, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import type { Role } from '../types'
import { Btn, Field, inputCls } from '../ui'

export default function Login() {
  const [role, setRole] = useState<Role>('receptionist')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(username.trim(), password, role)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="border-b border-slate-100 bg-linear-to-b from-teal-50/60 to-white p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
            <Stethoscope size={26} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">MediDesk Clinic Portal</h1>
          <p className="mt-1 text-xs text-slate-500">
            Secure Role-Based Access for Reception & Clinical Staff
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="p-6">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => handleRoleChange('receptionist')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition cursor-pointer ${
                role === 'receptionist'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon size={16} />
              <span>Receptionist</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('doctor')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition cursor-pointer ${
                role === 'doctor'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope size={16} />
              <span>Doctor</span>
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Username" required>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={role === 'doctor' ? 'doctor1' : 'reception1'}
                  className={`${inputCls} pl-9`}
                />
                <UserIcon size={16} className="absolute left-3 top-2.5 text-slate-400" />
              </div>
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pl-9 pr-9`}
                />
                <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <Btn
              type="submit"
              loading={loading}
              v={role === 'doctor' ? 'secondary' : 'primary'}
              className="w-full py-2.5 text-sm font-semibold shadow-md mt-2"
            >
              <LogIn size={16} />
              <span>Sign in as {role === 'doctor' ? 'Doctor' : 'Receptionist'}</span>
            </Btn>
          </form>
        </div>
      </div>
    </div>
  )
}
