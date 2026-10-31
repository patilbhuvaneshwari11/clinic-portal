import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CalendarCheck,
  CheckCircle,
  Clock,
  Filter,
  Plus,
  Stethoscope,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Appointment, Doctor, Paged, Patient } from '../types'
import { Badge, Btn, Card, Empty, Field, inputCls, Modal, Pager, selectCls, Spinner } from '../ui'

export default function Appointments() {
  const { user } = useAuth()
  const isReceptionist = user?.role === 'receptionist'
  const isDoctor = user?.role === 'doctor'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Filters & Pagination
  const [page, setPage] = useState(1)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')

  // Booking Modal
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookForm, setBookForm] = useState({
    patient_id: '',
    doctor_id: '',
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_time: '10:00',
    reason: '',
  })

  // Queries
  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => api<Doctor[]>('/doctors'),
  })

  const { data: patientsList } = useQuery<Paged<Patient>>({
    queryKey: ['patientsQuickList'],
    queryFn: () => api<Paged<Patient>>('/patients?size=100'),
    enabled: bookModalOpen,
  })

  const { data: pagedData, isLoading } = useQuery<Paged<Appointment>>({
    queryKey: ['appointments', page, selectedDate, selectedDoctorId, selectedStatus],
    queryFn: () => {
      const p = new URLSearchParams()
      p.set('page', String(page))
      p.set('size', '12')
      if (selectedDate) p.set('appt_date', selectedDate)
      if (selectedDoctorId) p.set('doctor_id', selectedDoctorId)
      if (selectedStatus && selectedStatus !== 'All') p.set('status_filter', selectedStatus)
      return api<Paged<Appointment>>(`/appointments?${p.toString()}`)
    },
  })

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/appointments/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: (_, vars) => {
      toast.success(`Appointment status updated to ${vars.status}`)
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api(`/appointments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Appointment cancelled.')
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const bookMutation = useMutation({
    mutationFn: (body: any) => api('/appointments', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Appointment scheduled successfully!')
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setBookModalOpen(false)
      setBookForm({
        patient_id: '',
        doctor_id: '',
        scheduled_date: new Date().toISOString().slice(0, 10),
        scheduled_time: '10:00',
        reason: '',
      })
    },
  })

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookForm.patient_id || !bookForm.doctor_id) {
      toast.error('Please select both patient and doctor.')
      return
    }

    const scheduled_at = `${bookForm.scheduled_date}T${bookForm.scheduled_time}:00`
    bookMutation.mutate({
      patient_id: Number(bookForm.patient_id),
      doctor_id: Number(bookForm.doctor_id),
      scheduled_at,
      reason: bookForm.reason.trim(),
    })
  }

  const setFilterToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10))
    setPage(1)
  }

  const setFilterTomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().slice(0, 10))
    setPage(1)
  }

  const clearDateFilter = () => {
    setSelectedDate('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Appointment Management</h1>
          <p className="text-xs text-slate-500">
            {isDoctor
              ? 'Your scheduled clinical consultations and queue status'
              : 'Master appointment schedule, patient check-in & slot management'}
          </p>
        </div>

        {isReceptionist && (
          <Btn
            v="primary"
            onClick={() => setBookModalOpen(true)}
            className="text-xs shadow-sm"
          >
            <CalendarCheck size={15} />
            <span>Schedule New Appointment</span>
          </Btn>
        )}
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar size={13} />
              <span>Date:</span>
            </span>
            <button
              onClick={clearDateFilter}
              className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                !selectedDate ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={setFilterToday}
              className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                selectedDate === new Date().toISOString().slice(0, 10)
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={setFilterTomorrow}
              className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                selectedDate && selectedDate !== new Date().toISOString().slice(0, 10)
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tomorrow
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-slate-300 px-2 py-0.5 text-xs text-slate-700 outline-none"
            />
          </div>

          {/* Doctor & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {!isDoctor && doctors && (
              <select
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value)
                  setPage(1)
                }}
                className={`${selectCls} text-xs py-1.5 w-44`}
              >
                <option value="">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.specialization})
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
              className={`${selectCls} text-xs py-1.5 w-36`}
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Checked In">Checked In</option>
              <option value="In Consultation">In Consultation</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Appointments List */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <Spinner text="Loading appointment bookings..." />
        ) : !pagedData || pagedData.items.length === 0 ? (
          <Empty
            icon={<Calendar size={36} />}
            text="No appointments found matching this criteria."
            action={
              isReceptionist && (
                <Btn v="primary" onClick={() => setBookModalOpen(true)} className="mt-2 text-xs">
                  <Plus size={14} /> Book Appointment
                </Btn>
              )
            }
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Scheduled Time</th>
                    <th className="px-5 py-3.5 font-semibold">Patient</th>
                    <th className="px-5 py-3.5 font-semibold">Doctor / Specialty</th>
                    <th className="px-5 py-3.5 font-semibold">Reason</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedData.items.map((appt) => {
                    const dt = new Date(appt.scheduled_at)
                    const dateFormatted = dt.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                    const timeFormatted = dt.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })

                    return (
                      <tr key={appt.id} className="hover:bg-teal-50/20 transition">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{timeFormatted}</div>
                          <div className="text-[11px] text-slate-400">{dateFormatted}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{appt.patient_name}</div>
                          <div className="font-mono text-[10px] text-slate-400">{appt.patient_code}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-800">{appt.doctor_name}</div>
                          <div className="text-[11px] text-teal-600 font-medium">
                            {appt.specialization}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{appt.reason}</td>
                        <td className="px-5 py-3.5">
                          <Badge text={appt.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Doctor consultation flow */}
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
                                  <span>Resume Consult</span>
                                </Btn>
                              ) : null
                            ) : (
                              /* Receptionist Check In flow */
                              appt.status === 'Scheduled' && (
                                <Btn
                                  v="success"
                                  onClick={() =>
                                    updateStatusMutation.mutate({ id: appt.id, status: 'Checked In' })
                                  }
                                  loading={updateStatusMutation.isPending}
                                  className="px-2.5 py-1 text-xs"
                                >
                                  <UserCheck size={13} />
                                  <span>Check In</span>
                                </Btn>
                              )
                            )}

                            {/* Cancel Button */}
                            {appt.status !== 'Completed' && appt.status !== 'Cancelled' && (
                              <button
                                title="Cancel Appointment"
                                onClick={() => {
                                  if (confirm(`Cancel appointment for ${appt.patient_name}?`)) {
                                    cancelMutation.mutate(appt.id)
                                  }
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                              >
                                <XCircle size={16} />
                              </button>
                            )}
                          </div>
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

      {/* Book Appointment Modal */}
      {bookModalOpen && (
        <Modal
          title="Schedule Patient Appointment"
          subtitle="Assign patient to specialist doctor slot"
          onClose={() => setBookModalOpen(false)}
        >
          <form onSubmit={handleBookSubmit} className="space-y-4">
            <Field label="Select Patient" required>
              <select
                required
                value={bookForm.patient_id}
                onChange={(e) => setBookForm({ ...bookForm, patient_id: e.target.value })}
                className={selectCls}
              >
                <option value="">-- Choose Patient --</option>
                {patientsList?.items.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.patient_code} - {pt.full_name} ({pt.age} yrs, {pt.phone})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Select Doctor" required>
              <select
                required
                value={bookForm.doctor_id}
                onChange={(e) => setBookForm({ ...bookForm, doctor_id: e.target.value })}
                className={selectCls}
              >
                <option value="">-- Choose Doctor / Specialist --</option>
                {doctors?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} — {d.specialization}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Appointment Date" required>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={bookForm.scheduled_date}
                  onChange={(e) => setBookForm({ ...bookForm, scheduled_date: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Time Slot" required>
                <input
                  type="time"
                  required
                  value={bookForm.scheduled_time}
                  onChange={(e) => setBookForm({ ...bookForm, scheduled_time: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Chief Complaint / Reason for Visit" required>
              <textarea
                required
                rows={2}
                value={bookForm.reason}
                onChange={(e) => setBookForm({ ...bookForm, reason: e.target.value })}
                placeholder="e.g. Chronic back ache, persistent fever, regular follow up..."
                className={inputCls}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Btn type="button" v="ghost" onClick={() => setBookModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" v="primary" loading={bookMutation.isPending}>
                Confirm Booking
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
