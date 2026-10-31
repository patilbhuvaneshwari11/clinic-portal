import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  Plus,
  Printer,
  Receipt,
  Search,
  Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import type { Invoice, Paged, PagedInvoices, Patient } from '../types'
import { Badge, Btn, Card, Empty, Field, inputCls, Modal, Pager, selectCls, Spinner } from '../ui'

export default function Billing() {
  const queryClient = useQueryClient()

  // Pagination & Filters
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('All')

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null)

  // Forms
  const [createForm, setCreateForm] = useState({
    patient_id: '',
    consultation_fee: 500,
    extra_fee: 0,
  })

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'UPI' as 'Cash' | 'Card' | 'UPI' | 'Insurance',
  })

  // Queries
  const { data: pagedInvoices, isLoading } = useQuery<PagedInvoices>({
    queryKey: ['invoices', page, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams()
      p.set('page', String(page))
      p.set('size', '12')
      if (statusFilter !== 'All') p.set('status_filter', statusFilter)
      return api<Paged<Invoice>>(`/invoices?${p.toString()}`)
    },
  })

  const { data: invoiceDetail, isLoading: isLoadingInvoice } = useQuery<Invoice>({
    queryKey: ['invoiceDetail', selectedInvoiceId],
    queryFn: () => api<Invoice>(`/invoices/${selectedInvoiceId}`),
    enabled: selectedInvoiceId !== null,
  })

  const { data: patientsList } = useQuery<Paged<Patient>>({
    queryKey: ['patientsForBilling'],
    queryFn: () => api<Paged<Patient>>('/patients?size=100'),
    enabled: createModalOpen,
  })

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: (body: any) => api('/invoices', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Invoice generated successfully!')
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setCreateModalOpen(false)
      setCreateForm({ patient_id: '', consultation_fee: 500, extra_fee: 0 })
    },
  })

  const recordPaymentMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      api(`/invoices/${id}/payments`, { method: 'POST', body }),
    onSuccess: (data: any) => {
      toast.success(`Payment recorded! Invoice status is now ${data.new_invoice_status}`)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoiceDetail'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setPayModalOpen(false)
      setActiveInvoice(null)
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.patient_id) {
      toast.error('Please select a patient.')
      return
    }

    createInvoiceMutation.mutate({
      patient_id: Number(createForm.patient_id),
      consultation_fee: Number(createForm.consultation_fee),
      extra_fee: Number(createForm.extra_fee),
    })
  }

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeInvoice) return

    if (paymentForm.amount <= 0) {
      toast.error('Payment amount must be greater than zero.')
      return
    }

    recordPaymentMutation.mutate({
      id: activeInvoice.id,
      body: paymentForm,
    })
  }

  const openPaymentModal = (inv: Invoice) => {
    const due = inv.total - inv.paid
    setActiveInvoice(inv)
    setPaymentForm({
      amount: due,
      method: 'UPI',
    })
    setPayModalOpen(true)
  }

  // Grand totals across ALL patients from backend summary
  const totalBilled =
    pagedInvoices?.summary?.total_billed ??
    pagedInvoices?.items.reduce((acc, curr) => acc + curr.total, 0) ??
    0

  const totalCollected =
    pagedInvoices?.summary?.total_paid ??
    pagedInvoices?.items.reduce((acc, curr) => acc + curr.paid, 0) ??
    0

  const outstanding =
    pagedInvoices?.summary?.total_outstanding ??
    Math.max(0, totalBilled - totalCollected)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Billing & Invoices</h1>
          <p className="text-xs text-slate-500">
            Generate patient consultation bills, record receipts & reconcile clinic payments
          </p>
        </div>

        <Btn
          v="primary"
          onClick={() => setCreateModalOpen(true)}
          className="text-xs shadow-sm"
        >
          <Plus size={15} />
          <span>Generate New Invoice</span>
        </Btn>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Invoiced</span>
            <Receipt size={16} className="text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">₹{totalBilled.toLocaleString()}</div>
          <p className="mt-1 text-[11px] text-slate-400">Current active ledger records</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Collected</span>
            <Wallet size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">₹{totalCollected.toLocaleString()}</div>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium">Reconciled successfully</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Outstanding Due</span>
            <CreditCard size={16} className="text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">₹{outstanding.toLocaleString()}</div>
          <p className="mt-1 text-[11px] text-slate-400">Pending patient balances</p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 text-xs">
        {['All', 'Unpaid', 'Partial', 'Paid'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st)
              setPage(1)
            }}
            className={`rounded-lg px-3 py-1.5 font-medium transition cursor-pointer ${
              statusFilter === st
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {st} Invoices
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <Spinner text="Loading invoices and billing ledgers..." />
        ) : !pagedInvoices || pagedInvoices.items.length === 0 ? (
          <Empty
            icon={<CreditCard size={36} />}
            text="No invoice records found."
            action={
              <Btn v="primary" onClick={() => setCreateModalOpen(true)} className="mt-2 text-xs">
                <Plus size={14} /> Create First Invoice
              </Btn>
            }
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Invoice ID</th>
                    <th className="px-5 py-3.5 font-semibold">Patient</th>
                    <th className="px-5 py-3.5 font-semibold">Consultation Fee</th>
                    <th className="px-5 py-3.5 font-semibold">Additional Fee</th>
                    <th className="px-5 py-3.5 font-semibold">Total Amount</th>
                    <th className="px-5 py-3.5 font-semibold">Paid Amount</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedInvoices.items.map((inv) => {
                    const due = inv.total - inv.paid

                    return (
                      <tr key={inv.id} className="hover:bg-teal-50/20 transition">
                        <td className="px-5 py-3.5 font-mono font-bold text-teal-700 whitespace-nowrap">
                          #{inv.id}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{inv.patient_name}</div>
                          <div className="font-mono text-[10px] text-slate-400">{inv.patient_code}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">₹{inv.consultation_fee}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">₹{inv.extra_fee}</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900">₹{inv.total}</td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-emerald-700">₹{inv.paid}</td>
                        <td className="px-5 py-3.5">
                          <Badge text={inv.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {due > 0.01 && (
                              <Btn
                                v="primary"
                                onClick={() => openPaymentModal(inv)}
                                className="px-2.5 py-1 text-xs"
                              >
                                <DollarSign size={13} />
                                <span>Pay Due (₹{due})</span>
                              </Btn>
                            )}

                            <button
                              title="View & Print Receipt"
                              onClick={() => setSelectedInvoiceId(inv.id)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                            >
                              <Receipt size={16} />
                            </button>
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
                size={pagedInvoices.size}
                total={pagedInvoices.total}
                onPage={(p) => setPage(p)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* View & Print Receipt Modal */}
      {selectedInvoiceId !== null && (
        <Modal
          title={`Clinic Invoice Receipt #${selectedInvoiceId}`}
          subtitle="Official billing document for clinic reception"
          onClose={() => setSelectedInvoiceId(null)}
        >
          {isLoadingInvoice || !invoiceDetail ? (
            <Spinner text="Loading invoice receipt..." />
          ) : (
            <div className="space-y-6">
              {/* Receipt Canvas */}
              <div id="printable-receipt" className="rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-800">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-teal-700">MediDesk Clinic & Diagnostic Center</h2>
                    <p className="text-slate-500">12 Medical Hub, Health Avenue, Metro City</p>
                    <p className="text-slate-500">Phone: +91 800-MEDIDESK · GSTIN: 29AAAAA0000A1Z5</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      INVOICE #{invoiceDetail.id}
                    </span>
                    <p className="text-slate-400 mt-1">
                      Date: {new Date(invoiceDetail.created_at).toLocaleDateString()}
                    </p>
                    <Badge text={invoiceDetail.status} />
                  </div>
                </div>

                {/* Patient particulars */}
                <div className="my-4 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Billed To:</span>
                    <strong className="text-sm font-semibold text-slate-900">{invoiceDetail.patient_name}</strong>
                    <div className="font-mono text-[11px] text-slate-500">{invoiceDetail.patient_code}</div>
                    <div className="text-slate-600">{invoiceDetail.patient_phone}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Billing Address:</span>
                    <div className="text-slate-600">{invoiceDetail.patient_address || 'Registered Address'}</div>
                  </div>
                </div>

                {/* Items Breakdown */}
                <table className="w-full text-left my-4 border-b border-slate-200">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2">Description</th>
                      <th className="py-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 font-medium">Doctor Consultation & Clinical Assessment</td>
                      <td className="py-2.5 text-right font-mono font-semibold">
                        ₹{invoiceDetail.consultation_fee.toFixed(2)}
                      </td>
                    </tr>
                    {invoiceDetail.extra_fee > 0 && (
                      <tr>
                        <td className="py-2.5 font-medium">Diagnostic Procedures & Consumables</td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          ₹{invoiceDetail.extra_fee.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-bold text-slate-900">
                      <td className="py-2.5">Total Amount Due</td>
                      <td className="py-2.5 text-right font-mono text-sm">
                        ₹{invoiceDetail.total.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="text-emerald-700 font-semibold">
                      <td className="py-1">Total Amount Paid</td>
                      <td className="py-1 text-right font-mono">
                        -₹{invoiceDetail.paid.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="text-rose-600 font-bold text-sm">
                      <td className="py-2">Outstanding Balance</td>
                      <td className="py-2 text-right font-mono">
                        ₹{(invoiceDetail.balance_due || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Payment History */}
                {invoiceDetail.payments && invoiceDetail.payments.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="font-bold text-slate-700 block mb-2">Recorded Payments:</span>
                    <div className="space-y-1">
                      {invoiceDetail.payments.map((p) => (
                        <div key={p.id} className="flex justify-between text-[11px] text-slate-600">
                          <span>
                            {new Date(p.created_at).toLocaleString()} via <strong>{p.method}</strong>
                          </span>
                          <span className="font-mono font-semibold text-emerald-700">₹{p.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-between items-center pt-2">
                <Btn type="button" v="ghost" onClick={() => setSelectedInvoiceId(null)}>
                  Close
                </Btn>
                <Btn
                  type="button"
                  v="primary"
                  onClick={() => window.print()}
                  className="gap-2"
                >
                  <Printer size={15} />
                  <span>Print Receipt</span>
                </Btn>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Create Invoice Modal */}
      {createModalOpen && (
        <Modal
          title="Generate Patient Invoice"
          subtitle="Charge consultation fees and clinic procedures"
          onClose={() => setCreateModalOpen(false)}
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Field label="Select Patient" required>
              <select
                required
                value={createForm.patient_id}
                onChange={(e) => setCreateForm({ ...createForm, patient_id: e.target.value })}
                className={selectCls}
              >
                <option value="">-- Choose Patient --</option>
                {patientsList?.items.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.patient_code} - {pt.full_name} ({pt.phone})
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Consultation Fee (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={createForm.consultation_fee}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, consultation_fee: Number(e.target.value) })
                  }
                  className={inputCls}
                />
              </Field>

              <Field label="Additional / Lab Procedures Fee (₹)">
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={createForm.extra_fee}
                  onChange={(e) => setCreateForm({ ...createForm, extra_fee: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs flex justify-between items-center">
              <span className="font-semibold text-slate-600">Calculated Grand Total:</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                ₹{(Number(createForm.consultation_fee) + Number(createForm.extra_fee)).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Btn type="button" v="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" v="primary" loading={createInvoiceMutation.isPending}>
                Generate Invoice
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Payment Modal */}
      {payModalOpen && activeInvoice && (
        <Modal
          title={`Record Payment for Invoice #${activeInvoice.id}`}
          subtitle={`Patient: ${activeInvoice.patient_name}`}
          onClose={() => setPayModalOpen(false)}
        >
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="rounded-xl bg-teal-50/70 border border-teal-200 p-4 text-xs flex justify-between items-center">
              <div>
                <span className="text-teal-700 block">Total Invoice: ₹{activeInvoice.total}</span>
                <span className="text-emerald-700 font-medium">Already Paid: ₹{activeInvoice.paid}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Outstanding Due</span>
                <span className="text-lg font-bold text-rose-600 font-mono">
                  ₹{(activeInvoice.total - activeInvoice.paid).toFixed(2)}
                </span>
              </div>
            </div>

            <Field label="Amount to Collect (₹)" required>
              <input
                type="number"
                min="1"
                max={activeInvoice.total - activeInvoice.paid}
                step="any"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>

            <Field label="Payment Method" required>
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as any })}
                className={selectCls}
              >
                <option value="UPI">UPI / QR Code</option>
                <option value="Cash">Cash at Counter</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Insurance">Health Insurance TPA</option>
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Btn type="button" v="ghost" onClick={() => setPayModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" v="success" loading={recordPaymentMutation.isPending}>
                Confirm Payment Receipt
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
