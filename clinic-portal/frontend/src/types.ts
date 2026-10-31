export type Role = 'receptionist' | 'doctor'

export type Status = 'Scheduled' | 'Checked In' | 'Waiting' | 'In Consultation' | 'Completed' | 'Cancelled' | 'No Show'

export interface User {
  id: number
  username: string
  full_name: string
  role: Role
  doctor_id?: number
  specialization?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Doctor {
  id: number
  user_id: number
  full_name: string
  specialization: string
  username?: string
}

export interface PatientInput {
  full_name: string
  dob: string
  gender: 'Male' | 'Female' | 'Other'
  phone: string
  email?: string | null
  address: string
  blood_group: string
  emergency_contact: string
  allergies: string
  conditions: string
}

export interface Patient extends PatientInput {
  id: number
  patient_code: string
  age: number
  active: boolean
  registered_on: string
}

export interface Prescription {
  id?: number
  consultation_id?: number
  medication: string
  dosage: string
  frequency: string
  duration: string
}

export interface Consultation {
  id: number
  appointment_id: number
  patient_id: number
  doctor_id: number
  symptoms: string
  diagnosis: string
  notes: string
  follow_up: string | null
  prescriptions: Prescription[]
  created_at: string
}

export interface Appointment {
  id: number
  patient_id: number
  doctor_id: number
  scheduled_at: string
  reason: string
  status: Status
  patient_name: string
  patient_code: string
  patient_phone?: string
  doctor_name: string
  specialization?: string
  consultation?: Consultation | null
}

export interface Payment {
  id: number
  invoice_id: number
  amount: number
  method: 'Cash' | 'Card' | 'UPI' | 'Insurance'
  created_at: string
}

export interface Invoice {
  id: number
  patient_id: number
  patient_name: string
  patient_code: string
  patient_phone?: string
  patient_address?: string
  consultation_fee: number
  extra_fee: number
  total: number
  paid: number
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Cancelled'
  created_at: string
  payments?: Payment[]
  balance_due?: number
}

export interface AuditLog {
  id: number
  user_id?: number
  username?: string
  action: string
  detail: string
  ip?: string
  created_at: string
}

export interface StatCard {
  label: string
  value: number
  change?: string
  color?: string
}

export interface WeeklyStat {
  day: string
  date?: string
  count: number
}

export interface StatusStat {
  status: string
  count: number
}

export interface Stats {
  cards: StatCard[]
  weekly: WeeklyStat[]
  today_by_status: StatusStat[]
  queue?: Appointment[]
}

export interface InvoiceSummary {
  total_billed: number
  total_paid: number
  total_outstanding: number
}

export interface PagedInvoices extends Paged<Invoice> {
  summary?: InvoiceSummary
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface PatientDetail extends Patient {
  appointments: Appointment[]
  consultations?: Consultation[]
  invoices?: Invoice[]
}
