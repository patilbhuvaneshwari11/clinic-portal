import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Plus,
  Stethoscope,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Appointment, Stats } from '../types'
import { Badge, Btn, Card, Spinner } from '../ui'

const PIE_COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e']

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch Dashboard Stats
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api<Stats>('/stats'),
  })

  // Quick Check In mutation (Receptionist)
  const checkInMutation = useMutation({
    mutationFn: (appointmentId: number) =>
      api(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: { status: 'Checked In' },
      }),
    onSuccess: () => {
      toast.success('Patient checked in and added to doctor queue!')
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })

  if (isLoading || !stats) {
    return <Spinner text="Loading clinic analytics..." />
  }

  const isDoctor = user?.role === 'doctor'

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-linear-to-r from-teal-700 via-teal-800 to-slate-900 p-6 text-white shadow-lg sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-teal-200">
            <Stethoscope size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isDoctor ? `Doctor Portal · ${user?.specialization || 'Consultant'}` : 'Reception Desk'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            Welcome, {user?.full_name}
          </h1>
          <p className="mt-1 text-xs text-teal-100/80">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          {!isDoctor ? (
            <>
              <Link to="/patients">
                <Btn v="primary" className="bg-teal-500 hover:bg-teal-600 text-white font-medium text-xs">
                  <UserPlus size={15} />
                  <span>Register Patient</span>
                </Btn>
              </Link>
              <Link to="/appointments">
                <Btn v="secondary" className="bg-slate-800/80 hover:bg-slate-800 text-white font-medium text-xs">
                  <Calendar size={15} />
                  <span>Book Appointment</span>
                </Btn>
              </Link>
              <Link to="/billing">
                <Btn v="ghost" className="border-teal-500/30 bg-teal-900/40 text-teal-100 hover:bg-teal-900/60 font-medium text-xs">
                  <CreditCard size={15} />
                  <span>Billing</span>
                </Btn>
              </Link>
            </>
          ) : (
            <Link to="/appointments">
              <Btn v="primary" className="bg-teal-500 hover:bg-teal-600 text-white font-medium text-xs">
                <Calendar size={15} />
                <span>View Full Schedule</span>
              </Btn>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.cards.map((card, idx) => (
          <Card key={idx} className="relative overflow-hidden p-4 transition hover:shadow-md">
            <div className="text-xs font-medium text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{card.value}</div>
            {card.change && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-teal-600">
                <TrendingUp size={12} />
                <span>{card.change}</span>
              </div>
            )}
            <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-teal-500" />
          </Card>
        ))}
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Appointment Activity Bar Chart */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Weekly Appointment Volume</h2>
              <p className="text-xs text-slate-500">Scheduled visits over the last 7 days</p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              Last 7 Days
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} name="Appointments" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Today's Status Breakdown</h2>
            <p className="text-xs text-slate-500">Live patient progression</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.today_by_status}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {stats.today_by_status.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Live Reception / Doctor Queue Board */}
      <Card>
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isDoctor ? "Today's Patient Queue" : 'Active Clinic Waiting Board'}
            </h2>
            <p className="text-xs text-slate-500">
              {isDoctor
                ? 'Patients waiting for consultation with you today'
                : 'Arrived and scheduled patients needing reception action'}
            </p>
          </div>
          <Link
            to="/appointments"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700"
          >
            View All Appointments &rarr;
          </Link>
        </div>

        {stats.queue && stats.queue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Doctor</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.queue.map((appt) => {
                  const apptTime = new Date(appt.scheduled_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400" />
                          <span>{apptTime}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{appt.patient_name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{appt.patient_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{appt.doctor_name}</div>
                        <div className="text-[10px] text-teal-600">{appt.specialization}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{appt.reason}</td>
                      <td className="px-4 py-3">
                        <Badge text={appt.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isDoctor ? (
                          appt.status === 'Checked In' || appt.status === 'Waiting' ? (
                            <Btn
                              v="primary"
                              onClick={() => navigate(`/consult/${appt.id}`)}
                              className="px-2.5 py-1 text-xs"
                            >
                              <Stethoscope size={13} />
                              <span>Start Consult</span>
                            </Btn>
                          ) : appt.status === 'In Consultation' ? (
                            <Btn
                              v="secondary"
                              onClick={() => navigate(`/consult/${appt.id}`)}
                              className="px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-700"
                            >
                              <span>Continue</span>
                            </Btn>
                          ) : (
                            <span className="text-[11px] text-slate-400">Completed</span>
                          )
                        ) : (
                          appt.status === 'Scheduled' ? (
                            <Btn
                              v="success"
                              onClick={() => checkInMutation.mutate(appt.id)}
                              loading={checkInMutation.isPending}
                              className="px-2.5 py-1 text-xs"
                            >
                              <UserCheck size={13} />
                              <span>Check In</span>
                            </Btn>
                          ) : (
                            <span className="text-[11px] font-medium text-teal-600">Checked In</span>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No active queue items right now.
          </div>
        )}
      </Card>
    </div>
  )
}
