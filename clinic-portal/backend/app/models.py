from datetime import date, datetime
from typing import Optional
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


class Stamps:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def pk():
    return mapped_column(Integer, primary_key=True)


def fk(table: str, **kw):
    return mapped_column(Integer, ForeignKey(f"{table}.id", ondelete="RESTRICT"), index=True, **kw)


class User(Stamps, Base):
    __tablename__ = "users"
    id: Mapped[int] = pk()
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime)


class UserSession(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = fk("users")
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Doctor(Stamps, Base):
    __tablename__ = "doctors"
    id: Mapped[int] = pk()
    user_id: Mapped[int] = fk("users", unique=True)
    specialization: Mapped[str] = mapped_column(String(80))


class Receptionist(Stamps, Base):
    __tablename__ = "receptionists"
    id: Mapped[int] = pk()
    user_id: Mapped[int] = fk("users", unique=True)
    desk: Mapped[str] = mapped_column(String(40))


class Patient(Stamps, Base):
    __tablename__ = "patients"
    id: Mapped[int] = pk()
    patient_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100), index=True)
    dob: Mapped[date] = mapped_column(Date, index=True)
    gender: Mapped[str] = mapped_column(String(10), index=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(String(250))
    blood_group: Mapped[str] = mapped_column(String(4))
    emergency_contact: Mapped[str] = mapped_column(String(100))
    allergies: Mapped[str] = mapped_column(Text, default="")
    conditions: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    registered_on: Mapped[date] = mapped_column(Date, default=date.today, index=True)


class Appointment(Stamps, Base):
    __tablename__ = "appointments"
    id: Mapped[int] = pk()
    patient_id: Mapped[int] = fk("patients")
    doctor_id: Mapped[int] = fk("doctors")
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    reason: Mapped[str] = mapped_column(String(250))
    status: Mapped[str] = mapped_column(String(20), default="Scheduled", index=True)


class Consultation(Stamps, Base):
    __tablename__ = "consultations"
    id: Mapped[int] = pk()
    appointment_id: Mapped[int] = fk("appointments", unique=True)
    patient_id: Mapped[int] = fk("patients")
    doctor_id: Mapped[int] = fk("doctors")
    symptoms: Mapped[str] = mapped_column(Text)
    diagnosis: Mapped[str] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text, default="")
    follow_up: Mapped[Optional[date]] = mapped_column(Date)


class Prescription(Stamps, Base):
    __tablename__ = "prescriptions"
    id: Mapped[int] = pk()
    consultation_id: Mapped[int] = fk("consultations")
    medication: Mapped[str] = mapped_column(String(100))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str] = mapped_column(String(100))
    duration: Mapped[str] = mapped_column(String(100))


class Invoice(Stamps, Base):
    __tablename__ = "invoices"
    id: Mapped[int] = pk()
    patient_id: Mapped[int] = fk("patients")
    consultation_fee: Mapped[float] = mapped_column(Float)
    extra_fee: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float)
    paid: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(10), default="Unpaid", index=True)


class Payment(Stamps, Base):
    __tablename__ = "payments"
    id: Mapped[int] = pk()
    invoice_id: Mapped[int] = fk("invoices")
    amount: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(10))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = pk()
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    detail: Mapped[str] = mapped_column(String(250), default="")  # ids only, never patient data
    ip: Mapped[Optional[str]] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
