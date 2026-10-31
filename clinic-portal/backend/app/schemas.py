from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

Role = Literal["receptionist", "doctor"]
Status = Literal["Scheduled", "Checked In", "Waiting", "In Consultation", "Completed", "Cancelled", "No Show"]
Short = Field(min_length=1, max_length=100)


# ---------- Auth ----------
class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    role: Role


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: Role
    doctor_id: Optional[int] = None
    specialization: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Doctors ----------
class DoctorOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    specialization: str
    username: Optional[str] = None


# ---------- Patients ----------
class PatientIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    dob: date
    gender: Literal["Male", "Female", "Other"]
    phone: str = Field(min_length=8, max_length=20)
    email: Optional[EmailStr] = None
    address: str = Field(min_length=3, max_length=250)
    blood_group: Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    emergency_contact: str = Field(min_length=3, max_length=100)
    allergies: str = Field(default="", max_length=500)
    conditions: str = Field(default="", max_length=500)

    @field_validator("dob")
    @classmethod
    def not_future(cls, v: date):
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v


class PatientOut(PatientIn):
    id: int
    patient_code: str
    age: int
    active: bool
    registered_on: date


# ---------- Appointments ----------
class AppointmentIn(BaseModel):
    patient_id: int
    doctor_id: int
    scheduled_at: datetime
    reason: str = Field(min_length=2, max_length=250)


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    reason: Optional[str] = Field(None, min_length=2, max_length=250)
    doctor_id: Optional[int] = None


class StatusIn(BaseModel):
    status: Status


# ---------- Prescriptions & Consultations ----------
class PrescriptionIn(BaseModel):
    medication: str = Short
    dosage: str = Short
    frequency: str = Short
    duration: str = Short


class PrescriptionOut(PrescriptionIn):
    id: int
    consultation_id: int


class PrescriptionCreate(PrescriptionIn):
    consultation_id: int


class ConsultationIn(BaseModel):
    appointment_id: int
    symptoms: str = Field(min_length=2, max_length=2000)
    diagnosis: str = Field(min_length=2, max_length=2000)
    notes: str = Field(default="", max_length=4000)
    follow_up: Optional[date] = None
    prescriptions: List[PrescriptionIn] = []


class ConsultationUpdate(BaseModel):
    symptoms: Optional[str] = Field(None, min_length=2, max_length=2000)
    diagnosis: Optional[str] = Field(None, min_length=2, max_length=2000)
    notes: Optional[str] = Field(None, max_length=4000)
    follow_up: Optional[date] = None


# ---------- Billing ----------
class InvoiceIn(BaseModel):
    patient_id: int
    consultation_fee: float = Field(ge=0, le=1_000_000)
    extra_fee: float = Field(default=0, ge=0, le=1_000_000)


class PaymentIn(BaseModel):
    amount: float = Field(gt=0, le=1_000_000)
    method: Literal["Cash", "Card", "UPI", "Insurance"]


# ---------- Export & Audit ----------
class ExportIn(BaseModel):
    confirm: bool
    limit: int = Field(ge=1, le=10_000)


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str] = None
    action: str
    detail: str
    ip: Optional[str]
    created_at: datetime
