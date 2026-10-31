import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Filter,
  Heart,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api, downloadCsv } from '../api'
import { useAuth } from '../auth'
import type { Paged, Patient, PatientDetail, PatientInput } from '../types'
import { Badge, Btn, Card, Empty, Field, inputCls, Modal, Pager, selectCls, Spinner } from '../ui'

const initialPatientForm: PatientInput = {
  full_name: '',
  dob: '',
  gender: 'Male',
  phone: '',
  email: '',
  address: '',
  blood_group: 'O+',
  emergency_contact: '',
  allergies: '',
  conditions: '',
}

export default function Patients() {
  const { user } = useAuth()
  const isReceptionist = user?.role === 'receptionist'
  const queryClient = useQueryClient()

  // Filters & Pagination
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('')

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)

  // Forms
  const [formData, setFormData] = useState<PatientInput>(initialPatientForm)
  const [exportLimit, setExportLimit] = useState(50)
  const [exportConfirm, setExportConfirm] = useState(false)

  // Query: Patients list
  const { data: pagedData, isLoading } = useQuery<Paged<Patient>>({
    queryKey: ['patients', page, search, genderFilter],
    queryFn: () => {
      const p = new URLSearchParams()
      p.set('page', String(page))
      p.set('size', '10')
      if (search.trim()) p.set('q', search.trim())
      if (genderFilter) p.set('gender', genderFilter)
      return api<Paged<Patient>>(`/patients?${p.toString()}`)
    },
  })

  // Query: Selected Patient Details
  const { data: patientDetail, isLoading: isLoadingDetail } = useQuery<PatientDetail>({
    queryKey: ['patientDetail', selectedPatientId],
    queryFn: () => api<PatientDetail>(`/patients/${selectedPatientId}`),
    enabled: selectedPatientId !== null,
  })

  // Mutation: Create Patient
  const createMutation = useMutation({
    mutationFn: (newPatient: PatientInput) =>
      api<Patient>('/patients', { method: 'POST', body: newPatient }),
    onSuccess: (data) => {
      toast.success(`Patient registered successfully! Assigned Code: ${data.patient_code}`)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setCreateModalOpen(false)
      setFormData(initialPatientForm)
    },
  })

  // Mutation: Update Patient
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PatientInput }) =>
      api<Patient>(`/patients/${id}`, { method: 'PUT', body: input }),
    onSuccess: () => {
      toast.success('Patient information updated!')
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patientDetail'] })
      setEditPatient(null)
    },
  })

  // Mutation: Deactivate Patient
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/patients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Patient deactivated successfully.')
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      if (selectedPatientId) setSelectedPatientId(null)
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editPatient) return
    updateMutation.mutate({ id: editPatient.id, input: formData })
  }

  const handleExportDownload = async () => {
    if (!exportConfirm) {
      toast.error('Please confirm the export checkbox.')
      return
    }
    try {
      await downloadCsv(
        '/patients/export',
        { confirm: true, limit: exportLimit },
        `patients_export_${new Date().toISOString().slice(0, 10)}.csv`
      )
      setExportModalOpen(false)
    } catch {
      // Handled in downloadCsv
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Patient Directory</h1>
          <p className="text-xs text-slate-500">
            {isReceptionist
              ? 'Register, manage and search clinical patient demographic records'
              : 'Patients assigned to your consultation schedule'}
          </p>
        </div>

        {isReceptionist ? (
          <Btn
            v="primary"
            onClick={() => {
              setFormData(initialPatientForm)
              setCreateModalOpen(true)
            }}
            className="text-xs shadow-sm"
          >
            <UserPlus size={15} />
            <span>Register Patient</span>
          </Btn>
        ) : (
          <Btn
            v="ghost"
            onClick={() => {
              setExportConfirm(false)
              setExportModalOpen(true)
            }}
            className="text-xs"
          >
            <Download size={15} />
            <span>Export Assigned Patients (CSV)</span>
          </Btn>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name, patient code (e.g. PT000010), phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className={`${inputCls} pl-9`}
            />
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          </div>

          <div className="flex items-center gap-2 sm:w-48">
            <Filter size={16} className="text-slate-400 shrink-0" />
            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value)
                setPage(1)
              }}
              className={selectCls}
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Patients Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <Spinner text="Loading patient records..." />
        ) : !pagedData || pagedData.items.length === 0 ? (
          <Empty
            icon={<Users size={36} />}
            text="No patient records match the search filter."
            action={
              isReceptionist && (
                <Btn
                  v="primary"
                  onClick={() => {
                    setFormData(initialPatientForm)
                    setCreateModalOpen(true)
                  }}
                  className="mt-2 text-xs"
                >
                  <Plus size={14} /> Register New Patient
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
                    <th className="px-5 py-3.5 font-semibold">Patient Code</th>
                    <th className="px-5 py-3.5 font-semibold">Full Name</th>
                    <th className="px-5 py-3.5 font-semibold">Age / Gender</th>
                    <th className="px-5 py-3.5 font-semibold">Contact</th>
                    <th className="px-5 py-3.5 font-semibold">Blood Group</th>
                    <th className="px-5 py-3.5 font-semibold">Allergies / Alerts</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedData.items.map((pt) => (
                    <tr
                      key={pt.id}
                      className="hover:bg-teal-50/30 transition cursor-pointer"
                      onClick={() => setSelectedPatientId(pt.id)}
                    >
                      <td className="px-5 py-3.5 font-mono font-semibold text-teal-700 whitespace-nowrap">
                        {pt.patient_code}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{pt.full_name}</div>
                        <div className="text-[11px] text-slate-400">{pt.address}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 whitespace-nowrap">
                        {pt.age} yrs · {pt.gender}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          <span>{pt.phone}</span>
                        </div>
                        {pt.email && <div className="text-[11px] text-slate-400">{pt.email}</div>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/50">
                          <Heart size={11} className="fill-rose-500 text-rose-500" />
                          {pt.blood_group}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate">
                        {pt.allergies ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <AlertTriangle size={12} className="text-amber-500" />
                            {pt.allergies}
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="View Patient Details"
                            onClick={() => setSelectedPatientId(pt.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          >
                            <Eye size={16} />
                          </button>
                          {isReceptionist && (
                            <>
                              <button
                                title="Edit Patient"
                                onClick={() => {
                                  setEditPatient(pt)
                                  setFormData({
                                    full_name: pt.full_name,
                                    dob: pt.dob,
                                    gender: pt.gender,
                                    phone: pt.phone,
                                    email: pt.email || '',
                                    address: pt.address,
                                    blood_group: pt.blood_group,
                                    emergency_contact: pt.emergency_contact,
                                    allergies: pt.allergies,
                                    conditions: pt.conditions,
                                  })
                                }}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700 cursor-pointer"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                title="Deactivate Patient"
                                onClick={() => {
                                  if (confirm(`Deactivate patient record ${pt.patient_code} (${pt.full_name})?`)) {
                                    deleteMutation.mutate(pt.id)
                                  }
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4">
              <Pager
                page={page}
                size={pagedData.size}
                total={pagedData.total}
                onPage={(newPage) => setPage(newPage)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Patient Profile / Details Modal */}
      {selectedPatientId !== null && (
        <Modal
          title={patientDetail ? `${patientDetail.full_name} (${patientDetail.patient_code})` : 'Patient Record'}
          subtitle="Comprehensive Clinical & Demographic Profile"
          onClose={() => setSelectedPatientId(null)}
          maxWidth="max-w-3xl"
        >
          {isLoadingDetail || !patientDetail ? (
            <Spinner text="Loading patient record..." />
          ) : (
            <div className="space-y-6">
              {/* Demographics Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Date of Birth / Age</span>
                  <span className="font-semibold text-slate-800">
                    {patientDetail.dob} ({patientDetail.age} yrs)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Gender</span>
                  <span className="font-semibold text-slate-800">{patientDetail.gender}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Blood Group</span>
                  <span className="font-bold text-rose-600">{patientDetail.blood_group}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone</span>
                  <span className="font-semibold text-slate-800">{patientDetail.phone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">Residential Address</span>
                  <span className="font-medium text-slate-800">{patientDetail.address}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">Emergency Contact</span>
                  <span className="font-medium text-slate-800">{patientDetail.emergency_contact}</span>
                </div>
              </div>

              {/* Medical Alerts Banner */}
              {(patientDetail.allergies || patientDetail.conditions) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
                    <AlertTriangle size={15} />
                    <span>Clinical Alerts & Known Conditions</span>
                  </div>
                  {patientDetail.allergies && (
                    <p>
                      <strong>Allergies:</strong> {patientDetail.allergies}
                    </p>
                  )}
                  {patientDetail.conditions && (
                    <p className="mt-0.5">
                      <strong>Pre-existing Conditions:</strong> {patientDetail.conditions}
                    </p>
                  )}
                </div>
              )}

              {/* Appointment History */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Appointment History ({patientDetail.appointments?.length || 0})
                </h3>
                {patientDetail.appointments && patientDetail.appointments.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs">
                    {patientDetail.appointments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50">
                        <div>
                          <div className="font-semibold text-slate-800">
                            {new Date(a.scheduled_at).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Dr. {a.doctor_name} ({a.specialization}) · {a.reason}
                          </div>
                        </div>
                        <Badge text={a.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No previous visits recorded.</p>
                )}
              </div>

              {/* Clinical History (Doctor Only) */}
              {user?.role === 'doctor' && patientDetail.consultations && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Doctor Consultations & Prescriptions
                  </h3>
                  <div className="space-y-3">
                    {patientDetail.consultations.map((c) => (
                      <div key={c.id} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-indigo-900">Diagnosis: {c.diagnosis}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-600 mb-2">
                          <strong>Symptoms:</strong> {c.symptoms}
                        </p>
                        {c.notes && (
                          <p className="text-slate-500 mb-2">
                            <strong>Notes:</strong> {c.notes}
                          </p>
                        )}
                        {c.prescriptions && c.prescriptions.length > 0 && (
                          <div className="mt-2 border-t border-indigo-100 pt-2">
                            <span className="font-semibold text-indigo-800 block mb-1">Prescriptions:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                              {c.prescriptions.map((px, idx) => (
                                <li key={idx}>
                                  <strong>{px.medication}</strong> ({px.dosage}) – {px.frequency} for {px.duration}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices History (Receptionist Only) */}
              {isReceptionist && patientDetail.invoices && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Invoices & Billing History
                  </h3>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs">
                    {patientDetail.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 bg-white">
                        <div>
                          <div className="font-semibold text-slate-800">
                            Invoice #{inv.id} · Total: ₹{inv.total} (Paid: ₹{inv.paid})
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(inv.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge text={inv.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Register New Patient Modal */}
      {createModalOpen && (
        <Modal
          title="Register New Patient"
          subtitle="Enter demographic and initial clinical intake details"
          onClose={() => setCreateModalOpen(false)}
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className={inputCls}
                />
              </Field>

              <Field label="Date of Birth" required>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Gender" required>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className={selectCls}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label="Blood Group" required>
                <select
                  value={formData.blood_group}
                  onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                  className={selectCls}
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </Field>

              <Field label="Phone Number" required>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className={inputCls}
                />
              </Field>

              <Field label="Email Address">
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="patient@example.com"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Residential Address" required>
              <textarea
                required
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Complete address with locality/city"
                className={inputCls}
              />
            </Field>

            <Field label="Emergency Contact (Name & Phone)" required>
              <input
                type="text"
                required
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                placeholder="e.g. Suman Kumar (Spouse) +91 9876500000"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Known Allergies">
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, Peanuts, Dust"
                  className={inputCls}
                />
              </Field>

              <Field label="Existing Medical Conditions">
                <input
                  type="text"
                  value={formData.conditions}
                  onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                  placeholder="e.g. Hypertension, Type 2 Diabetes"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Btn type="button" v="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" v="primary" loading={createMutation.isPending}>
                Save Patient Record
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Patient Modal */}
      {editPatient && (
        <Modal
          title={`Edit Patient: ${editPatient.patient_code}`}
          subtitle="Modify patient demographic information"
          onClose={() => setEditPatient(null)}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Date of Birth" required>
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone" required>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Address" required>
              <textarea
                required
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Btn type="button" v="ghost" onClick={() => setEditPatient(null)}>
                Cancel
              </Btn>
              <Btn type="submit" v="primary" loading={updateMutation.isPending}>
                Update Patient
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Safe CSV Export Modal (Doctor) */}
      {exportModalOpen && (
        <Modal
          title="Export Assigned Patient Data (CSV)"
          subtitle="Clinical records export for your assigned patient consultations"
          onClose={() => setExportModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 text-teal-900">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <FileSpreadsheet size={16} className="text-teal-700" />
                <span>Export Protocol Information</span>
              </div>
              <p>
                Bulk patient export files are encrypted in-transit, scrubbed of formulas to prevent CSV injection,
                and logged in the immutable security audit trail.
              </p>
            </div>

            <Field label="Number of Patient Records to Export">
              <select
                value={exportLimit}
                onChange={(e) => setExportLimit(Number(e.target.value))}
                className={selectCls}
              >
                <option value={25}>25 Records (Quick Sample)</option>
                <option value={50}>50 Records (Standard)</option>
                <option value={100}>100 Records (Safe Limit)</option>
                <option value={150}>150 Records (Triggers Security Threshold Alert)</option>
              </select>
            </Field>

            {exportLimit > 100 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle size={15} />
                  <span>Security Threshold Warning</span>
                </div>
                <p className="mt-1">
                  Requests exceeding 100 records are classified as potential bulk exfiltration. The system will log a
                  SUSPICIOUS_EXPORT event and block the request.
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={exportConfirm}
                onChange={(e) => setExportConfirm(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="font-semibold text-slate-700">
                I confirm this data export complies with clinical patient privacy policies.
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Btn type="button" v="ghost" onClick={() => setExportModalOpen(false)}>
                Cancel
              </Btn>
              <Btn
                type="button"
                v={exportLimit > 100 ? 'danger' : 'primary'}
                disabled={!exportConfirm}
                onClick={handleExportDownload}
              >
                <Download size={15} />
                <span>Download CSV File</span>
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
