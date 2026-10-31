# MediDesk — Clinic Reception Portal 🏥

A modern, production-grade Clinic Reception & Doctor Consultation Portal built with **React + TypeScript + Vite + Tailwind CSS** on the frontend and **FastAPI + SQLAlchemy + SQLite** on the backend.

The full repository code is located inside the [`clinic-portal`](./clinic-portal) directory.

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
cd clinic-portal/backend
pip install -r requirements.txt
python -m app.seed --reset
uvicorn app.main:app --reload --port 8000
```
- API Docs (Swagger UI): **http://localhost:8000/docs**
- Health Check: **http://localhost:8000/api/health**

---

### 2. Frontend Setup (React + Vite)
In a new terminal window:
```bash
cd clinic-portal/frontend
npm install
npm run dev
```
- Open application: **http://localhost:5173**

---

## 🔑 Demo Login Accounts

| Role | Username | Password | Features / Access |
|---|---|---|---|
| **Receptionist** | `reception1` … `reception5` | `Reception@123` | Patient Directory, Registration, Appointments Booking, Status Check-in, Billing & Invoicing, CSV Export, Security Audit Logs |
| **Doctor** | `doctor1` … `doctor10` | `Doctor@123` | Doctor Dashboard, Assigned Patient Queue, Clinical Examination, Vitals, Diagnosis, Dynamic Prescription Builder |

> **Convenience Feature**: The login screen includes 1-click Quick-Fill buttons for both Receptionist and Doctor demo accounts.
