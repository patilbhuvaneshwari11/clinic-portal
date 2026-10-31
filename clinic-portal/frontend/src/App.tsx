import { useState } from 'react'
import {
  CalendarDays,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Stethoscope,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import Appointments from './pages/Appointments'
import AuditLogs from './pages/AuditLogs'
import Billing from './pages/Billing'
import Consult from './pages/Consult'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Patients from './pages/Patients'
import { useTheme } from './theme'
import type { Role } from './types'
import { Spinner } from './ui'

function AuthGuard({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <Spinner text="Loading MediDesk AuraVale..." />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function PublicGuard() {
  const { user, loading } = useAuth()

  if (loading) {
    return <Spinner text="Authenticating..." />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/appointments', label: 'Appointments', icon: CalendarDays },
    ...(user?.role === 'receptionist'
      ? [
          { to: '/billing', label: 'Billing & Invoices', icon: CreditCard },
          { to: '/audit', label: 'Audit Logs', icon: History },
        ]
      : []),
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 antialiased transition-colors duration-150">
      {/* Sidebar for Desktop */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 md:flex transition-colors duration-150">
        {/* Brand header with Hospital Name */}
        <div className="flex h-18 items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 dark:bg-teal-500 text-white shadow-md shadow-teal-600/20">
            <Stethoscope size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              MediDesk
            </h1>
            <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400 truncate">
              AuraVale Hospital
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="mx-4 my-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/60 font-semibold text-teal-700 dark:text-teal-300">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                {user?.full_name}
              </p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    user?.role === 'doctor' ? 'bg-indigo-500' : 'bg-teal-500'
                  }`}
                />
                <span className="text-xs capitalize text-slate-500 dark:text-slate-400 truncate">
                  {user?.role === 'doctor' ? user?.specialization || 'Doctor' : 'Receptionist'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 px-3 py-2">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Dark / Light Mode Switcher */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {theme === 'dark' ? (
                <Moon size={15} className="text-teal-400" />
              ) : (
                <Sun size={15} className="text-amber-500" />
              )}
              <span className="capitalize">{theme} Theme</span>
            </div>
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700 transition-colors cursor-pointer"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-teal-400 transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* System info & Logout */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Secure JWT / RBAC Active</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
              <Stethoscope size={18} />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white leading-none block">
                MediDesk
              </span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400">
                AuraVale Hospital
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun size={18} className="text-amber-400" />
              ) : (
                <Moon size={18} className="text-slate-600" />
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:hidden">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/60 font-semibold text-teal-700 dark:text-teal-300">
                {user?.full_name?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold dark:text-white">{user?.full_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
            <nav className="space-y-1">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </nav>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicGuard />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<AuthGuard />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="appointments" element={<Appointments />} />

          {/* Receptionist Only Routes */}
          <Route element={<AuthGuard allowedRoles={['receptionist']} />}>
            <Route path="billing" element={<Billing />} />
            <Route path="audit" element={<AuditLogs />} />
          </Route>

          {/* Doctor Only Routes */}
          <Route element={<AuthGuard allowedRoles={['doctor']} />}>
            <Route path="consult/:appointmentId" element={<Consult />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
