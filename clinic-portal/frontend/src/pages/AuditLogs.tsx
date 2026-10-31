import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Filter, History, Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { api } from '../api'
import type { AuditLog, Paged } from '../types'
import { Btn, Card, Empty, Pager, selectCls, Spinner } from '../ui'

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')

  const { data: pagedData, isLoading } = useQuery<Paged<AuditLog>>({
    queryKey: ['auditLogs', page, actionFilter],
    queryFn: () => {
      const p = new URLSearchParams()
      p.set('page', String(page))
      p.set('size', '15')
      if (actionFilter) p.set('action', actionFilter)
      return api<Paged<AuditLog>>(`/audit-logs?${p.toString()}`)
    },
  })

  const getActionBadgeColor = (action: string) => {
    if (action.includes('LOCKED') || action.includes('FAILED') || action.includes('SUSPICIOUS')) {
      return 'bg-rose-50 text-rose-700 border-rose-200'
    }
    if (action.includes('CREATED') || action.includes('SUCCESS') || action.includes('COMPLETED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    if (action.includes('UPDATED') || action.includes('STATUS')) {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }
    return 'bg-teal-50 text-teal-700 border-teal-200'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Security & Activity Audit Trail</h1>
          <p className="text-xs text-slate-500">
            Immutable regulatory event logging for HIPAA/healthcare compliance and access audits
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Audit Log Retention Active</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setPage(1)
              }}
              className={`${selectCls} text-xs py-1.5 w-60`}
            >
              <option value="">All Security Events</option>
              <option value="LOGIN">User Login</option>
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="ACCOUNT_LOCKED">Account Locked</option>
              <option value="PATIENT_CREATED">Patient Registered</option>
              <option value="PATIENT_VIEWED">Patient Viewed</option>
              <option value="APPOINTMENT_CREATED">Appointment Scheduled</option>
              <option value="APPOINTMENT_STATUS_CHANGED">Status Changed</option>
              <option value="CONSULTATION_CREATED">Consultation Completed</option>
              <option value="PAYMENT_RECORDED">Payment Recorded</option>
              <option value="EXPORT_COMPLETED">Export Completed</option>
              <option value="EXPORT_SUSPICIOUS">Export Alert Triggered</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Total Logged Events: {pagedData?.total || 0}
          </span>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <Spinner text="Loading immutable audit logs..." />
        ) : !pagedData || pagedData.items.length === 0 ? (
          <Empty icon={<History size={36} />} text="No audit records match the selected filter." />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                    <th className="px-5 py-3.5 font-semibold">Action / Event</th>
                    <th className="px-5 py-3.5 font-semibold">User Account</th>
                    <th className="px-5 py-3.5 font-semibold">Event Parameters / Detail</th>
                    <th className="px-5 py-3.5 text-right font-semibold">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {pagedData.items.map((log) => {
                    const dt = new Date(log.created_at)
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap font-sans">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-800 whitespace-nowrap">
                          {log.username || 'System'}
                        </td>
                        <td className="px-5 py-3 text-slate-600 font-sans max-w-md truncate">
                          {log.detail || '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-400 whitespace-nowrap">
                          {log.ip || '127.0.0.1'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4">
              <Pager
                page={page}
                size={pagedData.size}
                total={pagedData.total}
                onPage={(p) => setPage(p)}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
