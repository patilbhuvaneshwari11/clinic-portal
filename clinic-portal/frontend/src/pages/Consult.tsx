import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  FileCheck,
  Heart,
  Pill,
  Plus,
  Stethoscope,
  Trash2,
  User,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../api'
import type { Appointment, Prescription } from '../types'
import { Badge, Btn, Card, Field, inputCls, Spinner } from '../ui'

export default function Consult() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Form State
  const [symptoms, setSymptoms] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([
    { medication: '', dosage: '500 mg', frequency: 'Twice daily', duration: '5 days' },
  ])

  // Fetch Appointment
  const { data: appt, isLoading } = useQuery<Appointment>({
    queryKey: ['appointment', appointmentId],
    queryFn: () => api<Appointment>(`/appointments/${appointmentId}`),
    enabled: Boolean(appointmentId),
  })

  // Set initial status to In Consultation if it's currently Checked In or Waiting
  useEffect(() => {
    if (appt && (appt.status === 'Checked In' || appt.status === 'Waiting')) {
      api(`/appointments/${appt.id}/status`, {
        method: 'PATCH',
        body: { status: 'In Consultation' },
        quiet: true,
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['appointments'] })
          queryClient.invalidateQueries({ queryKey: ['stats'] })
        })
        .catch(() => {})
    }

    if (appt && !symptoms) {
      setSymptoms(appt.reason || '')
    }
  }, [appt])

  // Mutation: Submit Consultation
  const consultMutation = useMutation({
    mutationFn: (body: any) => api('/consultations', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Consultation completed and prescription saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate('/appointments')
    },
  })

  const addPrescriptionRow = () => {
    setPrescriptions([
      ...prescriptions,
      { medication: '', dosage: '500 mg', frequency: 'Twice daily', duration: '5 days' },
    ])
  }

  const removePrescriptionRow = (index: number) => {
    if (prescriptions.length === 1) {
      setPrescriptions([{ medication: '', dosage: '', frequency: '', duration: '' }])
      return
    }
    setPrescriptions(prescriptions.filter((_, i) => i !== index))
  }

  const updatePrescriptionField = (
    index: number,
    field: keyof Prescription,
    value: string
  ) => {
    const updated = [...prescriptions]
    updated[index] = { ...updated[index], [field]: value }
    setPrescriptions(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!diagnosis.trim()) {
      toast.error('Please enter a clinical diagnosis.')
      return
    }

    // Filter out completely empty prescription rows
    const validPrescriptions = prescriptions.filter((p) => p.medication.trim().length > 0)

    consultMutation.mutate({
      appointment_id: Number(appointmentId),
      symptoms: symptoms.trim() || 'General consultation',
      diagnosis: diagnosis.trim(),
      notes: notes.trim(),
      follow_up: followUp || null,
      prescriptions: validPrescriptions,
    })
  }

  if (isLoading || !appt) {
    return <Spinner text="Loading patient consultation room..." />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Schedule</span>
        </button>
        <div className="flex items-center gap-2">
          <Badge text={appt.status} />
          <span className="text-xs text-slate-400">Appointment #{appt.id}</span>
        </div>
      </div>

      {/* Patient Summary Banner */}
      <Card className="border-teal-100 bg-linear-to-r from-teal-50/70 via-white to-indigo-50/40 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white font-bold text-lg shadow-sm">
              {appt.patient_name?.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{appt.patient_name}</h1>
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-mono text-xs text-slate-600">
                  {appt.patient_code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Assigned to: <strong className="text-slate-700">{appt.doctor_name}</strong> (
                {appt.specialization})
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2 text-xs">
            <span className="text-slate-400 block">Reported Complaint</span>
            <span className="font-semibold text-slate-800">{appt.reason}</span>
          </div>
        </div>
      </Card>

      {/* Clinical Consultation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Clinical Notes Card */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Stethoscope size={18} className="text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900">Clinical Assessment & Examination</h2>
          </div>

          <Field label="Symptoms & Chief Complaints" required>
            <textarea
              required
              rows={2}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Detailed description of symptoms reported by the patient..."
              className={inputCls}
            />
          </Field>

          <Field label="Clinical Diagnosis" required>
            <input
              type="text"
              required
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Acute Viral Bronchitis, Type 2 Diabetes follow-up, Essential Hypertension..."
              className={inputCls}
            />
          </Field>

          <Field label="Clinical Examination & Observations (Vitals / Notes)">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="BP: 120/80 mmHg, Pulse: 72 bpm, SpO2: 98%, Temp: 98.6°F. Systemic examination normal..."
              className={inputCls}
            />
          </Field>

          <div className="w-full sm:w-1/2">
            <Field label="Follow-up Recommendation Date">
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Card>

        {/* Prescription Builder Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Pill size={18} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Prescriptions & Medications</h2>
            </div>
            <Btn
              type="button"
              v="ghost"
              onClick={addPrescriptionRow}
              className="text-xs py-1 px-2.5"
            >
              <Plus size={13} />
              <span>Add Drug</span>
            </Btn>
          </div>

          <div className="space-y-3">
            {prescriptions.map((px, index) => (
              <div
                key={index}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Medication Name
                  </label>
                  <input
                    type="text"
                    value={px.medication}
                    onChange={(e) => updatePrescriptionField(index, 'medication', e.target.value)}
                    placeholder="e.g. Paracetamol"
                    className={`${inputCls} py-1.5 text-xs bg-white`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Dosage</label>
                  <input
                    type="text"
                    value={px.dosage}
                    onChange={(e) => updatePrescriptionField(index, 'dosage', e.target.value)}
                    placeholder="e.g. 500 mg"
                    className={`${inputCls} py-1.5 text-xs bg-white`}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Frequency</label>
                  <select
                    value={px.frequency}
                    onChange={(e) => updatePrescriptionField(index, 'frequency', e.target.value)}
                    className={`${inputCls} py-1.5 text-xs bg-white`}
                  >
                    <option value="Once daily">Once daily (OD)</option>
                    <option value="Twice daily">Twice daily (BD)</option>
                    <option value="Thrice daily">Thrice daily (TDS)</option>
                    <option value="Every 4 hours">Every 4 hours</option>
                    <option value="As needed (SOS)">As needed (SOS)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Duration</label>
                  <input
                    type="text"
                    value={px.duration}
                    onChange={(e) => updatePrescriptionField(index, 'duration', e.target.value)}
                    placeholder="e.g. 5 days"
                    className={`${inputCls} py-1.5 text-xs bg-white`}
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removePrescriptionRow(index)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    title="Remove prescription"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <Btn type="button" v="ghost" onClick={() => navigate('/appointments')}>
            Cancel
          </Btn>
          <Btn
            type="submit"
            v="primary"
            loading={consultMutation.isPending}
            className="px-6 py-2.5 text-sm font-semibold shadow-md"
          >
            <Check size={16} />
            <span>Complete Consultation & Issue Prescriptions</span>
          </Btn>
        </div>
      </form>
    </div>
  )
}
