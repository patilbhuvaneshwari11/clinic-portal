import React, { ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

export const inputCls =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-950/50 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-500'

export const selectCls =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-950/50'

const btnVariants = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm focus:ring-2 focus:ring-teal-400',
  secondary: 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 shadow-sm focus:ring-2 focus:ring-slate-400',
  ghost: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm focus:ring-2 focus:ring-rose-400',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-2 focus:ring-emerald-400',
  subtle: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
}

export function Btn({
  v = 'primary',
  className = '',
  loading = false,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  v?: keyof typeof btnVariants
  loading?: boolean
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${btnVariants[v]} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export const Card = ({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) => (
  <div
    className={`rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-slate-900 dark:text-slate-100 transition-colors duration-150 ${className}`}
  >
    {children}
  </div>
)

export const Field = ({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) => (
  <label className="block text-sm">
    <span className="mb-1.5 flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
      {label} {required && <span className="text-rose-500">*</span>}
    </span>
    {children}
    {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
  </label>
)

export const Spinner = ({ text }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 p-12 text-teal-600 dark:text-teal-400">
    <Loader2 className="animate-spin" size={32} />
    {text && <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{text}</span>}
  </div>
)

export const Empty = ({
  icon,
  text,
  action,
}: {
  icon?: ReactNode
  text: string
  action?: ReactNode
}) => (
  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
    {icon && <div className="text-slate-400 dark:text-slate-600">{icon}</div>}
    <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
    {action && <div className="mt-2">{action}</div>}
  </div>
)

export function Modal({
  title,
  subtitle,
  onClose,
  maxWidth = 'max-w-2xl',
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  maxWidth?: string
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`max-h-[90vh] w-full ${maxWidth} flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-slate-800 dark:text-slate-200">{children}</div>
      </div>
    </div>
  )
}

export function Pager({
  page,
  size,
  total,
  onPage,
}: {
  page: number
  size: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  const start = total === 0 ? 0 : (page - 1) * size + 1
  const end = Math.min(page * size, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
      <span>
        Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{start}</span> to{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{end}</span> of{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span> entries
      </span>
      <div className="flex items-center gap-1.5">
        <Btn
          v="ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-2.5 py-1 text-xs"
        >
          Previous
        </Btn>
        <span className="px-2 font-medium text-slate-700 dark:text-slate-200">
          Page {page} of {pages}
        </span>
        <Btn
          v="ghost"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="px-2.5 py-1 text-xs"
        >
          Next
        </Btn>
      </div>
    </div>
  )
}

const badgeStyles: Record<string, string> = {
  Scheduled: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800',
  'Checked In': 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200/60 dark:border-teal-800',
  Waiting: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800',
  'In Consultation': 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800',
  Completed: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800',
  Cancelled: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800',
  'No Show': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  Paid: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800',
  Partial: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800',
  Unpaid: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800',
}

export const Badge = ({ text }: { text: string }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeStyles[text] || 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
  >
    {text}
  </span>
)
