# MediDesk — Clinic Reception Portal 🏥

A modern, production-grade Clinic Reception & Doctor Consultation Portal built with **React + TypeScript + Vite + Tailwind CSS** on the frontend and **FastAPI + SQLAlchemy + SQLite** on the backend.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, TanStack Query v5, Recharts, Lucide Icons, React Hot Toast |
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2, SQLite (`clinic.db`) |
| **Security & Auth** | JWT Access Tokens (HS256), bcrypt password hashing (12 rounds), Role-Based Access Control (RBAC), brute-force account lockout, CSV formula injection defense, immutable audit logging |

---

## 🚀 Quick Start Guide

### 1. Backend Setup (FastAPI)
```bash
# Navigate to backend directory
cd backend

# (Optional) Create & activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install required packages
pip install -r requirements.txt

# Run database seed (idempotent; creates SQLite tables & populates mock data)
python -m app.seed --reset

# Start the FastAPI server (runs on port 8000)
uvicorn app.main:app --reload --port 8000
```
- API Docs (Swagger UI): **http://localhost:8000/docs**
- Health Check: **http://localhost:8000/api/health**

---

### 2. Frontend Setup (React + Vite)
In a new terminal window:
```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server (runs on port 5173 with proxy to backend)
npm run dev
```
- Open application: **http://localhost:5173**

---

## 🔑 Demo Login Accounts

The database comes pre-seeded with 5 Receptionists and 10 Specialist Doctors.

| Role | Username | Password | Features / Access |
|---|---|---|---|
| **Receptionist** | `reception1` … `reception5` | `Reception@123` | Patient Directory, Registration, Appointments Booking, Status Check-in, Billing & Invoicing, CSV Export, Security Audit Logs |
| **Doctor** | `doctor1` … `doctor10` | `Doctor@123` | Doctor Dashboard, Assigned Patient Queue, Clinical Examination, Vitals, Diagnosis, Dynamic Prescription Builder |

> **Convenience Feature**: The login screen includes 1-click Quick-Fill buttons for both Receptionist and Doctor demo accounts.

---

## 🌟 Key Features & Workflow

### 1. Role-Based Access Control (RBAC) & Security
- **Strict Backend Enforcement**: Every API endpoint validates the JWT token and enforces role permissions via FastAPI dependency injection (`require("receptionist")`, `require("doctor")`).
- **Protected Routing**: React Router guards prevent unauthorized navigation and redirect unauthenticated users to `/login`.
- **Brute-Force Account Protection**: 5 consecutive failed login attempts automatically lock the account for 15 minutes, logged to the security audit trail.
- **Stateless JWT**: Secure Bearer tokens transmitted via the `Authorization: Bearer <token>` header, automatically managed by the API client and TanStack Query.

---

### 2. Receptionist Portal
- **Dashboard**:
  - Live metric cards: Total Patients, Today's Appointments, Waiting Queue, Completed Today, Cancelled Visits, Active Doctors.
  - Interactive **Recharts** visualizations: 7-day appointment volume bar chart and status distribution donut chart.
  - Live Waiting Queue with **1-click Patient Check-In**.
- **Patient Directory (`/patients`)**:
  - Real-time debounced search by name, unique patient code (e.g. `PT000042`), phone number, or email.
  - Gender and active status filters with pagination.
  - **Register Patient Modal**: Form validation for demographics, age calculation, blood group, emergency contact, and clinical allergy alerts.
  - **Comprehensive Patient Profile Drawer**: View contact info, medical alerts, complete appointment history, and prior invoices.
  - **Safe CSV Export**: Regulatory export with formula injection sanitization (`'` prefix on dangerous symbols) and safety threshold alert.
- **Appointment Scheduling (`/appointments`)**:
  - Filter by date (Today, Tomorrow, Pick date), doctor, and appointment status.
  - **Slot Conflict Detection**: Prevents double-booking a doctor at the same time slot (returns HTTP 409).
  - Status progression: `Scheduled` → `Checked In` → `In Consultation` → `Completed`.
- **Billing & Invoices (`/billing`)**:
  - Real-time billing stats: Total Invoiced, Total Collected, Outstanding Due.
  - Generate new patient invoices with consultation fees and extra diagnostics/procedure charges.
  - **Record Payments**: Accepts `Cash`, `Card`, `UPI`, and `Insurance` with automatic status updates (`Paid` / `Partial`).
  - **Printable Medical Receipt**: Formatted clinic receipt with line items, payments, and browser print trigger.
- **Security Audit Logs (`/audit`)**:
  - Chronological audit records of all user actions: Logins, Patient Creations, Views, Payments, and Data Exports with actor, timestamp, and IP address.

---

### 3. Doctor Consultation Portal
- **Doctor Dashboard**:
  - Filtered specifically to the logged-in doctor's assigned patients and schedule.
  - Live Queue table of arriving and checked-in patients.
  - **1-Click "Start Consult"**: Immediately transitions status to `In Consultation` and opens the patient's consultation room.
- **Consultation Room (`/consult/:appointmentId`)**:
  - Patient overview banner displaying demographics, assigned doctor, and prominent clinical allergy warnings.
  - **Clinical Documentation Form**:
    - Chief complaints & symptoms.
    - Clinical diagnosis.
    - Clinical examination & vitals observation notes (BP, Pulse, Temp, SpO2).
    - Follow-up date recommendation.
  - **Interactive Prescription Builder**:
    - Add multiple prescription rows dynamically (Medication Name, Dosage, Frequency, Duration).
  - **Complete & Issue**: Saves the clinical record, writes prescriptions, marks the appointment as `Completed`, and notifies the reception queue.

---

## 📂 Project Architecture

```text
clinic-portal/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── db.py           # SQLite connection, SessionLocal & DeclarativeBase
│   │   ├── models.py       # SQLAlchemy ORM models (User, Doctor, Patient, Appointment, Consultation, Prescription, Invoice, Payment, AuditLog)
│   │   ├── schemas.py      # Pydantic v2 validation models
│   │   ├── security.py     # bcrypt hashing, JWT access tokens, RBAC dependencies
│   │   ├── seed.py         # Realistic demo seed script (200 patients, 10 doctors, 300 appointments, etc.)
│   │   └── main.py         # FastAPI application routes & middleware
│   ├── requirements.txt    # Python dependencies
│   └── clinic.db           # SQLite database
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx        # Branded role-tabbed login screen with quick-fill
│   │   │   ├── Dashboard.tsx    # Role-adaptive analytics & live queue board
│   │   │   ├── Patients.tsx     # Directory, registration, patient profile & CSV export
│   │   │   ├── Appointments.tsx # Calendar schedule, booking modal & conflict validation
│   │   │   ├── Consult.tsx      # Doctor consultation room & prescription builder
│   │   │   ├── Billing.tsx      # Invoicing, payment recording & receipt printing
│   │   │   └── AuditLogs.tsx    # Compliance security audit log viewer
│   │   ├── api.ts          # Central fetch client with JWT Bearer handling & download helpers
│   │   ├── auth.tsx         # AuthContext provider & user session state
│   │   ├── types.ts        # TypeScript interfaces & types
│   │   ├── ui.tsx          # Reusable medical UI components (Modal, Card, Badge, Pager, Btn)
│   │   ├── App.tsx         # Main layout shell, sidebar & protected route guards
│   │   ├── main.tsx        # React root with QueryClientProvider & Toaster
│   │   └── index.css       # Tailwind CSS styling tokens
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

---

## 🛡 Security Architecture Highlights
1. **Password Security**: Passwords hashed with standard `bcrypt` using 12 salt rounds.
2. **Stateless JWT**: Standard HS256 tokens with 24-hour expiration and Bearer authorization header validation.
3. **Account Lockout**: 5 consecutive failed attempts trigger a 15-minute lockout to block brute-force attacks.
4. **CSV Injection Defense**: Neutralizes leading formula characters (`=`, `+`, `-`, `@`) when exporting tabular data.
5. **Auditing**: All clinical and administrative actions log IDs and events without exposing confidential health parameters.
