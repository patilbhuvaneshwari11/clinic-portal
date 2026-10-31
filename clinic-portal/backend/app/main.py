import csv
import io
import os
from datetime import date, datetime, time, timedelta
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, or_, select, update
from . import schemas as s
from .db import Base, engine, get_db
from .models import (Appointment, AuditLog, Consultation, Doctor, Invoice, Patient, Payment,
                     Prescription, Receptionist, User, UserSession)
from .security import (ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token, current_user,
                       hash_password, require, verify_password)

EXPORT_ALERT = int(os.getenv("EXPORT_ALERT_THRESHOLD", "100"))

# RBAC dependencies
REC = require("receptionist")
DOC = require("doctor")
ANY = require("receptionist", "doctor")

RECEPTION_ALLOWED_STATUSES = {"Scheduled", "Checked In", "Waiting", "Cancelled", "No Show"}
DOCTOR_ALLOWED_STATUSES = {"In Consultation", "Completed"}

Base.metadata.create_all(engine)

app = FastAPI(
    title="Clinic Reception Portal API",
    description="Production-grade API for Clinic Receptionists and Doctors",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- helpers ----------
def err(status_code: int, code: str, msg: str):
    return HTTPException(status_code=status_code, detail={"code": code, "message": msg})


def row_dict(obj, **extra):
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    d.update(extra)
    return d


def calc_age(d: date) -> int:
    today = date.today()
    return today.year - d.year - ((today.month, today.day) < (d.month, d.day))


def patient_dict(p: Patient) -> dict:
    return row_dict(p, age=calc_age(p.dob))


def audit(db, user, action: str, detail: str = "", req: Request | None = None):
    try:
        db.add(AuditLog(
            user_id=user.id if user else None,
            action=action,
            detail=detail,
            ip=req.client.host if req and req.client else None
        ))
    except Exception:
        pass


def paginate(db, query, count_col, page: int, size: int, formatter):
    total = db.scalar(select(func.count()).select_from(query.with_only_columns(count_col).order_by(None).subquery()))
    items = db.execute(query.limit(size).offset((page - 1) * size)).all()
    return {
        "items": [formatter(r) for r in items],
        "total": total or 0,
        "page": page,
        "size": size,
        "pages": max(1, (total + size - 1) // size if total else 1)
    }


def get_doctor_profile(db, user: User) -> Doctor:
    doc = db.scalar(select(Doctor).where(Doctor.user_id == user.id))
    if not doc:
        raise err(403, "NO_DOCTOR_PROFILE", "No doctor profile associated with this account.")
    return doc


def is_patient_assigned(db, doctor: Doctor, patient_id: int) -> bool:
    return db.scalar(
        select(Appointment.id).where(
            Appointment.doctor_id == doctor.id,
            Appointment.patient_id == patient_id
        ).limit(1)
    ) is not None


def check_slot_available(db, doctor_id: int, when: datetime, exclude_id: Optional[int] = None):
    # Don't allow scheduling far in past (> 5 minutes ago)
    if when < datetime.now() - timedelta(minutes=5):
        raise err(400, "PAST_DATE", "Appointment cannot be scheduled in the past.")

    q = select(Appointment.id).where(
        Appointment.doctor_id == doctor_id,
        Appointment.scheduled_at == when,
        Appointment.status != "Cancelled"
    )
    if exclude_id:
        q = q.where(Appointment.id != exclude_id)
    if db.scalar(q):
        raise err(409, "SLOT_TAKEN", "This doctor already has an active appointment at that time slot.")


# ---------- Health Check ----------
@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat(), "service": "clinic-portal-api"}


# ---------- Authentication ----------
@app.post("/api/auth/login", response_model=s.Token)
def login(b: s.LoginIn, req: Request, db=Depends(get_db)):
    u = db.scalar(select(User).where(User.username == b.username))
    now = datetime.utcnow()

    # Check brute force lock
    if u and u.locked_until and u.locked_until > now:
        remaining = int((u.locked_until - now).total_seconds() / 60) + 1
        raise err(423, "LOCKED", f"Account locked due to multiple failed logins. Try again in {remaining} minute(s).")

    if not u or not u.active or u.role != b.role or not verify_password(b.password, u.password_hash):
        if u:
            u.failed_attempts += 1
            if u.failed_attempts >= 5:
                u.locked_until = now + timedelta(minutes=15)
                u.failed_attempts = 0
                audit(db, u, "ACCOUNT_LOCKED", "5_consecutive_failed_attempts", req)
        audit(db, u, "LOGIN_FAILED", f"role={b.role}", req)
        db.commit()
        raise err(401, "INVALID_CREDENTIALS", "Invalid username, password, or role selected.")

    # Successful login: reset counters
    u.failed_attempts = 0
    u.locked_until = None
    audit(db, u, "LOGIN", f"role={u.role}", req)
    db.commit()

    # Generate JWT token
    token_payload = {
        "sub": str(u.id),
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "full_name": u.full_name
    }
    token = create_access_token(token_payload)

    user_out = {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "role": u.role,
    }
    if u.role == "doctor":
        doc = db.scalar(select(Doctor).where(Doctor.user_id == u.id))
        if doc:
            user_out["doctor_id"] = doc.id
            user_out["specialization"] = doc.specialization

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_out
    }


@app.post("/api/auth/logout", status_code=200)
def logout(req: Request, u: User = Depends(current_user), db=Depends(get_db)):
    audit(db, u, "LOGOUT", "", req)
    db.commit()
    return {"message": "Logged out successfully"}


@app.get("/api/auth/me", response_model=s.UserOut)
def me(u: User = Depends(current_user), db=Depends(get_db)):
    resp = {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "role": u.role
    }
    if u.role == "doctor":
        doc = db.scalar(select(Doctor).where(Doctor.user_id == u.id))
        if doc:
            resp["doctor_id"] = doc.id
            resp["specialization"] = doc.specialization
    return resp


# ---------- Dashboard & Statistics ----------
@app.get("/api/stats")
def stats(u: User = Depends(ANY), db=Depends(get_db)):
    today = date.today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today + timedelta(days=1), time.min)

    doc = get_doctor_profile(db, u) if u.role == "doctor" else None
    filt = [Appointment.doctor_id == doc.id] if doc else []

    # Appointments today by status
    by_status = dict(db.execute(
        select(Appointment.status, func.count())
        .where(Appointment.scheduled_at >= start, Appointment.scheduled_at < end, *filt)
        .group_by(Appointment.status)
    ).all())

    waiting = by_status.get("Checked In", 0) + by_status.get("Waiting", 0)
    in_consult = by_status.get("In Consultation", 0)
    completed_today = by_status.get("Completed", 0)
    cancelled_today = by_status.get("Cancelled", 0)
    total_today = sum(by_status.values())

    # Weekly trend (last 7 days)
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    per_day = dict(db.execute(
        select(func.date(Appointment.scheduled_at), func.count())
        .where(
            Appointment.scheduled_at >= datetime.combine(days[0], time.min),
            Appointment.scheduled_at < end,
            *filt
        ).group_by(func.date(Appointment.scheduled_at))
    ).all())
    weekly = [{"day": d.strftime("%a"), "date": d.isoformat(), "count": per_day.get(d.isoformat(), 0)} for d in days]

    # Status distribution for donut/pie chart
    status_order = ["Scheduled", "Checked In", "In Consultation", "Completed", "Cancelled"]
    today_by_status = [{"status": st, "count": by_status.get(st, 0)} for st in status_order if by_status.get(st, 0) > 0]
    if not today_by_status:
        today_by_status = [{"status": "No appointments", "count": 0}]

    if doc:
        assigned_pts = db.scalar(
            select(func.count(func.distinct(Appointment.patient_id)))
            .where(Appointment.doctor_id == doc.id)
        ) or 0
        total_consultations = db.scalar(
            select(func.count()).select_from(Consultation)
            .where(Consultation.doctor_id == doc.id)
        ) or 0

        cards = [
            {"label": "Today's Appointments", "value": total_today, "change": "+Today", "color": "blue"},
            {"label": "Waiting in Queue", "value": waiting, "change": "Action Needed", "color": "amber"},
            {"label": "In Consultation", "value": in_consult, "change": "In Progress", "color": "purple"},
            {"label": "Completed Today", "value": completed_today, "change": "Finished", "color": "emerald"},
            {"label": "Assigned Patients", "value": assigned_pts, "change": "Total", "color": "teal"},
            {"label": "Total Consultations", "value": total_consultations, "change": "All-time", "color": "slate"},
        ]
    else:
        total_patients = db.scalar(select(func.count()).select_from(Patient).where(Patient.active)) or 0
        total_doctors = db.scalar(select(func.count()).select_from(Doctor)) or 0
        total_invoices_paid = db.scalar(
            select(func.coalesce(func.sum(Invoice.paid), 0.0))
        ) or 0.0

        cards = [
            {"label": "Total Active Patients", "value": total_patients, "change": "Registered", "color": "teal"},
            {"label": "Today's Appointments", "value": total_today, "change": "Scheduled", "color": "blue"},
            {"label": "Waiting / Checked In", "value": waiting, "change": "In Clinic", "color": "amber"},
            {"label": "Completed Today", "value": completed_today, "change": "Success", "color": "emerald"},
            {"label": "Cancelled / No Show", "value": cancelled_today, "change": "Today", "color": "rose"},
            {"label": "Active Doctors", "value": total_doctors, "change": "On Duty", "color": "indigo"},
        ]

    # Queue items for quick view
    queue_q = (
        select(Appointment, Patient.full_name, Patient.patient_code, Doctor.specialization, User.full_name)
        .join(Patient, Appointment.patient_id == Patient.id)
        .join(Doctor, Appointment.doctor_id == Doctor.id)
        .join(User, Doctor.user_id == User.id)
        .where(
            Appointment.scheduled_at >= start,
            Appointment.scheduled_at < end,
            Appointment.status.in_(["Checked In", "Waiting", "In Consultation", "Scheduled"]),
            *filt
        )
        .order_by(Appointment.scheduled_at.asc())
        .limit(10)
    )
    queue_rows = db.execute(queue_q).all()
    queue = [
        {
            **row_dict(a),
            "patient_name": p_name,
            "patient_code": p_code,
            "doctor_name": d_name,
            "specialization": spec,
        }
        for a, p_name, p_code, spec, d_name in queue_rows
    ]

    return {
        "cards": cards,
        "weekly": weekly,
        "today_by_status": today_by_status,
        "queue": queue
    }


# ---------- Doctors ----------
@app.get("/api/doctors")
def list_doctors(u: User = Depends(ANY), db=Depends(get_db)):
    rows = db.execute(
        select(Doctor, User.full_name, User.username)
        .join(User, Doctor.user_id == User.id)
        .where(User.active)
        .order_by(Doctor.id.asc())
    ).all()
    return [
        {
            "id": d.id,
            "user_id": d.user_id,
            "specialization": d.specialization,
            "full_name": full_name,
            "username": username
        }
        for d, full_name, username in rows
    ]


@app.get("/api/doctors/{did}")
def get_doctor(did: int, u: User = Depends(ANY), db=Depends(get_db)):
    row = db.execute(
        select(Doctor, User.full_name, User.username)
        .join(User, Doctor.user_id == User.id)
        .where(Doctor.id == did)
    ).first()
    if not row:
        raise err(404, "NOT_FOUND", "Doctor not found.")
    d, full_name, username = row
    return {
        "id": d.id,
        "user_id": d.user_id,
        "specialization": d.specialization,
        "full_name": full_name,
        "username": username
    }


# ---------- Patients ----------
@app.get("/api/patients")
def list_patients(
    q: str = "",
    gender: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    registered_from: Optional[date] = None,
    registered_to: Optional[date] = None,
    active: bool = True,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    u: User = Depends(ANY),
    db=Depends(get_db)
):
    st = select(Patient).where(Patient.active == active).order_by(desc(Patient.id))

    # Doctor RBAC: if doctor, see patients that have had appointments with them
    if u.role == "doctor":
        doc = get_doctor_profile(db, u)
        st = st.where(
            Patient.id.in_(
                select(Appointment.patient_id).where(Appointment.doctor_id == doc.id)
            )
        )

    if q.strip():
        term = f"%{q.strip()}%"
        st = st.where(
            or_(
                Patient.full_name.ilike(term),
                Patient.patient_code.ilike(term),
                Patient.phone.like(term),
                Patient.email.ilike(term)
            )
        )
    if gender:
        st = st.where(Patient.gender == gender)

    today = date.today()
    if min_age is not None:
        st = st.where(Patient.dob <= today - timedelta(days=int(min_age * 365.25)))
    if max_age is not None:
        st = st.where(Patient.dob >= today - timedelta(days=int((max_age + 1) * 365.25)))
    if registered_from:
        st = st.where(Patient.registered_on >= registered_from)
    if registered_to:
        st = st.where(Patient.registered_on <= registered_to)

    return paginate(db, st, Patient.id, page, size, lambda r: patient_dict(r[0]))


@app.post("/api/patients", status_code=201)
def create_patient(b: s.PatientIn, req: Request, u: User = Depends(REC), db=Depends(get_db)):
    p = Patient(
        patient_code=f"TMP{os.urandom(3).hex().upper()}",
        **b.model_dump()
    )
    db.add(p)
    db.flush()
    p.patient_code = f"PT{p.id:06d}"
    audit(db, u, "PATIENT_CREATED", f"patient_id={p.id}, code={p.patient_code}", req)
    db.commit()
    return patient_dict(p)


@app.get("/api/patients/{pid}")
def get_patient(pid: int, req: Request, u: User = Depends(ANY), db=Depends(get_db)):
    p = db.get(Patient, pid)
    if not p:
        raise err(404, "NOT_FOUND", "Patient not found.")

    doc = get_doctor_profile(db, u) if u.role == "doctor" else None
    if doc and not is_patient_assigned(db, doc, pid):
        raise err(403, "FORBIDDEN", "This patient is not assigned to your schedule.")

    out = patient_dict(p)

    # Attach appointments
    appts = db.execute(
        select(Appointment, User.full_name, Doctor.specialization)
        .join(Doctor, Appointment.doctor_id == Doctor.id)
        .join(User, Doctor.user_id == User.id)
        .where(Appointment.patient_id == pid)
        .order_by(desc(Appointment.scheduled_at))
    ).all()
    out["appointments"] = [
        row_dict(a, doctor_name=d_name, specialization=spec)
        for a, d_name, spec in appts
    ]

    # Clinical history: Doctors only
    if doc:
        cons = db.scalars(
            select(Consultation)
            .where(Consultation.patient_id == pid)
            .order_by(desc(Consultation.created_at))
        ).all()
        out["consultations"] = [
            row_dict(
                c,
                prescriptions=[
                    row_dict(px) for px in db.scalars(
                        select(Prescription).where(Prescription.consultation_id == c.id)
                    ).all()
                ]
            )
            for c in cons
        ]

    # Invoices history: Receptionist
    if u.role == "receptionist":
        invs = db.scalars(
            select(Invoice).where(Invoice.patient_id == pid).order_by(desc(Invoice.id))
        ).all()
        out["invoices"] = [
            row_dict(
                inv,
                payments=[row_dict(pm) for pm in db.scalars(select(Payment).where(Payment.invoice_id == inv.id)).all()]
            )
            for inv in invs
        ]

    audit(db, u, "PATIENT_VIEWED", f"patient_id={pid}", req)
    db.commit()
    return out


@app.put("/api/patients/{pid}")
def update_patient(pid: int, b: s.PatientIn, req: Request, u: User = Depends(REC), db=Depends(get_db)):
    p = db.get(Patient, pid)
    if not p:
        raise err(404, "NOT_FOUND", "Patient not found.")
    for k, v in b.model_dump().items():
        setattr(p, k, v)
    audit(db, u, "PATIENT_UPDATED", f"patient_id={pid}", req)
    db.commit()
    return patient_dict(p)


@app.delete("/api/patients/{pid}", status_code=204)
def deactivate_patient(pid: int, req: Request, u: User = Depends(REC), db=Depends(get_db)):
    p = db.get(Patient, pid)
    if not p:
        raise err(404, "NOT_FOUND", "Patient not found.")
    p.active = False
    audit(db, u, "PATIENT_DEACTIVATED", f"patient_id={pid}", req)
    db.commit()
    return Response(status_code=204)


def sanitize_csv_val(val: Any) -> str:
    """Neutralize potential CSV formula injection (=, +, -, @)."""
    s_val = str(val or "")
    if s_val and s_val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s_val
    return s_val


@app.post("/api/patients/export")
def export_patients(b: s.ExportIn, req: Request, u: User = Depends(DOC), db=Depends(get_db)):
    if not b.confirm:
        raise err(400, "CONFIRMATION_REQUIRED", "Export action must be confirmed explicitly.")

    if b.limit > EXPORT_ALERT:
        audit(db, u, "EXPORT_SUSPICIOUS", f"requested_rows={b.limit}", req)
        db.commit()
        raise err(
            403,
            "SUSPICIOUS_EXPORT",
            f"Requested export of {b.limit} rows exceeds safe threshold ({EXPORT_ALERT}). Security alert triggered."
        )

    doc = get_doctor_profile(db, u)
    pts = db.scalars(
        select(Patient)
        .where(
            Patient.active,
            Patient.id.in_(
                select(Appointment.patient_id).where(Appointment.doctor_id == doc.id)
            )
        )
        .order_by(Patient.id.asc())
        .limit(b.limit)
    ).all()

    audit(db, u, "EXPORT_COMPLETED", f"doctor_id={doc.id}, exported_rows={len(pts)}", req)
    db.commit()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Patient Code", "Full Name", "DOB", "Gender", "Phone", "Email",
        "Blood Group", "Emergency Contact", "Allergies", "Conditions", "Registered On"
    ])
    for p in pts:
        writer.writerow([
            p.patient_code,
            sanitize_csv_val(p.full_name),
            p.dob.isoformat(),
            p.gender,
            p.phone,
            sanitize_csv_val(p.email),
            p.blood_group,
            sanitize_csv_val(p.emergency_contact),
            sanitize_csv_val(p.allergies),
            sanitize_csv_val(p.conditions),
            p.registered_on.isoformat()
        ])

    csv_data = output.getvalue()
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=doctor_assigned_patients_{date.today().isoformat()}.csv"}
    )


# ---------- Appointments ----------
@app.get("/api/appointments")
def list_appointments(
    appt_date: Optional[date] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(15, ge=1, le=100),
    u: User = Depends(ANY),
    db=Depends(get_db)
):
    st = (
        select(Appointment, Patient.full_name, Patient.patient_code, Patient.phone,
               Doctor.specialization, User.full_name)
        .join(Patient, Appointment.patient_id == Patient.id)
        .join(Doctor, Appointment.doctor_id == Doctor.id)
        .join(User, Doctor.user_id == User.id)
        .order_by(desc(Appointment.scheduled_at))
    )

    if u.role == "doctor":
        doc = get_doctor_profile(db, u)
        st = st.where(Appointment.doctor_id == doc.id)
    elif doctor_id:
        st = st.where(Appointment.doctor_id == doctor_id)

    if patient_id:
        st = st.where(Appointment.patient_id == patient_id)

    if appt_date:
        start = datetime.combine(appt_date, time.min)
        end = datetime.combine(appt_date + timedelta(days=1), time.min)
        st = st.where(Appointment.scheduled_at >= start, Appointment.scheduled_at < end)

    if status_filter and status_filter != "All":
        st = st.where(Appointment.status == status_filter)

    def fmt_appt(r):
        a, p_name, p_code, p_phone, spec, d_name = r
        return {
            **row_dict(a),
            "patient_name": p_name,
            "patient_code": p_code,
            "patient_phone": p_phone,
            "specialization": spec,
            "doctor_name": d_name
        }

    return paginate(db, st, Appointment.id, page, size, fmt_appt)


@app.post("/api/appointments", status_code=201)
def create_appointment(b: s.AppointmentIn, req: Request, u: User = Depends(REC), db=Depends(get_db)):
    # Verify patient exists
    pt = db.get(Patient, b.patient_id)
    if not pt or not pt.active:
        raise err(404, "PATIENT_NOT_FOUND", "Active patient not found.")

    # Verify doctor exists
    doc = db.get(Doctor, b.doctor_id)
    if not doc:
        raise err(404, "DOCTOR_NOT_FOUND", "Doctor not found.")

    # Check slot conflicts
    check_slot_available(db, b.doctor_id, b.scheduled_at)

    appt = Appointment(
        patient_id=b.patient_id,
        doctor_id=b.doctor_id,
        scheduled_at=b.scheduled_at,
        reason=b.reason,
        status="Scheduled"
    )
    db.add(appt)
    db.flush()
    audit(db, u, "APPOINTMENT_CREATED", f"appt_id={appt.id}, doc={doc.id}, pt={pt.id}", req)
    db.commit()

    doc_user = db.get(User, doc.user_id)
    return {
        **row_dict(appt),
        "patient_name": pt.full_name,
        "patient_code": pt.patient_code,
        "doctor_name": doc_user.full_name if doc_user else "",
        "specialization": doc.specialization
    }


@app.get("/api/appointments/{aid}")
def get_appointment(aid: int, u: User = Depends(ANY), db=Depends(get_db)):
    r = db.execute(
        select(Appointment, Patient.full_name, Patient.patient_code, Patient.phone,
               Doctor.specialization, User.full_name)
        .join(Patient, Appointment.patient_id == Patient.id)
        .join(Doctor, Appointment.doctor_id == Doctor.id)
        .join(User, Doctor.user_id == User.id)
        .where(Appointment.id == aid)
    ).first()
    if not r:
        raise err(404, "NOT_FOUND", "Appointment not found.")

    a, p_name, p_code, p_phone, spec, d_name = r

    if u.role == "doctor":
        doc = get_doctor_profile(db, u)
        if a.doctor_id != doc.id:
            raise err(403, "FORBIDDEN", "This appointment is assigned to another doctor.")

    # Consultation if exists
    consultation = db.scalar(select(Consultation).where(Consultation.appointment_id == a.id))
    prescriptions = []
    if consultation:
        prescriptions = [row_dict(px) for px in db.scalars(
            select(Prescription).where(Prescription.consultation_id == consultation.id)
        ).all()]

    return {
        **row_dict(a),
        "patient_name": p_name,
        "patient_code": p_code,
        "patient_phone": p_phone,
        "specialization": spec,
        "doctor_name": d_name,
        "consultation": row_dict(consultation, prescriptions=prescriptions) if consultation else None
    }


@app.patch("/api/appointments/{aid}/status")
def update_appointment_status(aid: int, b: s.StatusIn, req: Request, u: User = Depends(ANY), db=Depends(get_db)):
    appt = db.get(Appointment, aid)
    if not appt:
        raise err(404, "NOT_FOUND", "Appointment not found.")

    # Role validation
    if u.role == "receptionist":
        if b.status not in RECEPTION_ALLOWED_STATUSES:
            raise err(403, "FORBIDDEN_TRANSITION", f"Receptionists cannot set status to '{b.status}'.")
    elif u.role == "doctor":
        doc = get_doctor_profile(db, u)
        if appt.doctor_id != doc.id:
            raise err(403, "FORBIDDEN", "You can only update appointments assigned to you.")
        if b.status not in DOCTOR_ALLOWED_STATUSES and b.status != "Waiting":
            raise err(403, "FORBIDDEN_TRANSITION", f"Doctors cannot set status to '{b.status}'.")

    old_status = appt.status
    appt.status = b.status
    audit(db, u, "APPOINTMENT_STATUS_CHANGED", f"id={aid}, from={old_status}, to={b.status}", req)
    db.commit()

    return {"id": appt.id, "status": appt.status, "message": f"Appointment status updated to '{appt.status}'."}


@app.put("/api/appointments/{aid}")
def reschedule_appointment(aid: int, b: s.AppointmentUpdate, req: Request, u: User = Depends(REC), db=Depends(get_db)):
    appt = db.get(Appointment, aid)
    if not appt:
        raise err(404, "NOT_FOUND", "Appointment not found.")

    new_doc_id = b.doctor_id or appt.doctor_id
    new_time = b.scheduled_at or appt.scheduled_at

    if b.scheduled_at or b.doctor_id:
        check_slot_available(db, new_doc_id, new_time, exclude_id=aid)

    if b.doctor_id:
        appt.doctor_id = b.doctor_id
    if b.scheduled_at:
        appt.scheduled_at = b.scheduled_at
    if b.reason:
        appt.reason = b.reason

    audit(db, u, "APPOINTMENT_RESCHEDULED", f"id={aid}, new_time={new_time.isoformat()}", req)
    db.commit()
    return row_dict(appt)


@app.delete("/api/appointments/{aid}")
def cancel_appointment(aid: int, req: Request, u: User = Depends(ANY), db=Depends(get_db)):
    appt = db.get(Appointment, aid)
    if not appt:
        raise err(404, "NOT_FOUND", "Appointment not found.")

    if u.role == "doctor":
        doc = get_doctor_profile(db, u)
        if appt.doctor_id != doc.id:
            raise err(403, "FORBIDDEN", "Cannot cancel appointment assigned to another doctor.")

    appt.status = "Cancelled"
    audit(db, u, "APPOINTMENT_CANCELLED", f"id={aid}", req)
    db.commit()
    return {"id": aid, "status": "Cancelled", "message": "Appointment cancelled successfully."}


# ---------- Consultations & Prescriptions (Doctor Role) ----------
@app.get("/api/consultations")
def list_consultations(
    patient_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    size: int = Query(15, ge=1, le=100),
    u: User = Depends(DOC),
    db=Depends(get_db)
):
    doc = get_doctor_profile(db, u)
    st = select(Consultation).where(Consultation.doctor_id == doc.id).order_by(desc(Consultation.created_at))
    if patient_id:
        st = st.where(Consultation.patient_id == patient_id)

    def fmt_c(r):
        c = r[0]
        prescriptions = [row_dict(px) for px in db.scalars(
            select(Prescription).where(Prescription.consultation_id == c.id)
        ).all()]
        return row_dict(c, prescriptions=prescriptions)

    return paginate(db, st, Consultation.id, page, size, fmt_c)


@app.post("/api/consultations", status_code=201)
def create_consultation(b: s.ConsultationIn, req: Request, u: User = Depends(DOC), db=Depends(get_db)):
    doc = get_doctor_profile(db, u)

    appt = db.get(Appointment, b.appointment_id)
    if not appt:
        raise err(404, "APPOINTMENT_NOT_FOUND", "Appointment not found.")
    if appt.doctor_id != doc.id:
        raise err(403, "FORBIDDEN", "You can only conduct consultations for your own appointments.")

    # Check if consultation already exists for this appointment
    existing = db.scalar(select(Consultation).where(Consultation.appointment_id == b.appointment_id))
    if existing:
        raise err(409, "ALREADY_EXISTS", "A consultation note has already been recorded for this appointment.")

    consultation = Consultation(
        appointment_id=b.appointment_id,
        patient_id=appt.patient_id,
        doctor_id=doc.id,
        symptoms=b.symptoms,
        diagnosis=b.diagnosis,
        notes=b.notes,
        follow_up=b.follow_up
    )
    db.add(consultation)
    db.flush()

    # Add prescriptions
    for p_in in b.prescriptions:
        px = Prescription(
            consultation_id=consultation.id,
            medication=p_in.medication,
            dosage=p_in.dosage,
            frequency=p_in.frequency,
            duration=p_in.duration
        )
        db.add(px)

    # Automatically mark appointment Completed
    appt.status = "Completed"

    audit(db, u, "CONSULTATION_CREATED", f"cons_id={consultation.id}, appt={appt.id}, patient={appt.patient_id}", req)
    db.commit()

    created_pxs = [row_dict(px) for px in db.scalars(
        select(Prescription).where(Prescription.consultation_id == consultation.id)
    ).all()]

    return row_dict(consultation, prescriptions=created_pxs)


@app.get("/api/consultations/{cid}")
def get_consultation(cid: int, u: User = Depends(ANY), db=Depends(get_db)):
    c = db.get(Consultation, cid)
    if not c:
        raise err(404, "NOT_FOUND", "Consultation record not found.")

    if u.role == "doctor":
        doc = get_doctor_profile(db, u)
        if c.doctor_id != doc.id:
            raise err(403, "FORBIDDEN", "Consultation was created by another doctor.")

    prescriptions = [row_dict(px) for px in db.scalars(
        select(Prescription).where(Prescription.consultation_id == c.id)
    ).all()]

    pt = db.get(Patient, c.patient_id)
    return row_dict(c, prescriptions=prescriptions, patient_name=pt.full_name if pt else "", patient_code=pt.patient_code if pt else "")


@app.put("/api/consultations/{cid}")
def update_consultation(cid: int, b: s.ConsultationUpdate, req: Request, u: User = Depends(DOC), db=Depends(get_db)):
    doc = get_doctor_profile(db, u)
    c = db.get(Consultation, cid)
    if not c:
        raise err(404, "NOT_FOUND", "Consultation not found.")
    if c.doctor_id != doc.id:
        raise err(403, "FORBIDDEN", "You can only edit your own consultation records.")

    if b.symptoms is not None:
        c.symptoms = b.symptoms
    if b.diagnosis is not None:
        c.diagnosis = b.diagnosis
    if b.notes is not None:
        c.notes = b.notes
    if b.follow_up is not None:
        c.follow_up = b.follow_up

    audit(db, u, "CONSULTATION_UPDATED", f"cons_id={cid}", req)
    db.commit()
    return row_dict(c)


@app.post("/api/prescriptions", status_code=201)
def add_prescription(b: s.PrescriptionCreate, req: Request, u: User = Depends(DOC), db=Depends(get_db)):
    doc = get_doctor_profile(db, u)
    c = db.get(Consultation, b.consultation_id)
    if not c or c.doctor_id != doc.id:
        raise err(403, "FORBIDDEN", "Consultation not found or not owned by doctor.")

    px = Prescription(
        consultation_id=b.consultation_id,
        medication=b.medication,
        dosage=b.dosage,
        frequency=b.frequency,
        duration=b.duration
    )
    db.add(px)
    db.flush()
    audit(db, u, "PRESCRIPTION_ADDED", f"px_id={px.id}, cons={c.id}", req)
    db.commit()
    return row_dict(px)


# ---------- Billing & Invoices (Receptionist Role) ----------
@app.get("/api/invoices/summary")
def get_invoices_summary(
    patient_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    u: User = Depends(REC),
    db=Depends(get_db)
):
    summary_q = select(
        func.coalesce(func.sum(Invoice.total), 0.0),
        func.coalesce(func.sum(Invoice.paid), 0.0)
    )
    if patient_id:
        summary_q = summary_q.where(Invoice.patient_id == patient_id)
    if status_filter and status_filter != "All":
        summary_q = summary_q.where(Invoice.status == status_filter)

    total_billed, total_paid = db.execute(summary_q).first() or (0.0, 0.0)
    return {
        "total_billed": float(total_billed),
        "total_paid": float(total_paid),
        "total_outstanding": float(max(0.0, total_billed - total_paid))
    }


@app.get("/api/invoices")
def list_invoices(
    patient_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(15, ge=1, le=100),
    u: User = Depends(REC),
    db=Depends(get_db)
):
    st = (
        select(Invoice, Patient.full_name, Patient.patient_code, Patient.phone)
        .join(Patient, Invoice.patient_id == Patient.id)
        .order_by(desc(Invoice.id))
    )

    if patient_id:
        st = st.where(Invoice.patient_id == patient_id)
    if status_filter and status_filter != "All":
        st = st.where(Invoice.status == status_filter)

    def fmt_inv(r):
        inv, p_name, p_code, p_phone = r
        return {
            **row_dict(inv),
            "patient_name": p_name,
            "patient_code": p_code,
            "patient_phone": p_phone
        }

    res = paginate(db, st, Invoice.id, page, size, fmt_inv)

    # Calculate overall sums across ALL patients / invoices in the database
    summary_q = select(
        func.coalesce(func.sum(Invoice.total), 0.0),
        func.coalesce(func.sum(Invoice.paid), 0.0)
    )
    if patient_id:
        summary_q = summary_q.where(Invoice.patient_id == patient_id)
    if status_filter and status_filter != "All":
        summary_q = summary_q.where(Invoice.status == status_filter)

    total_billed, total_paid = db.execute(summary_q).first() or (0.0, 0.0)
    res["summary"] = {
        "total_billed": float(total_billed),
        "total_paid": float(total_paid),
        "total_outstanding": float(max(0.0, total_billed - total_paid))
    }

    return res


@app.post("/api/invoices", status_code=201)
def create_invoice(b: s.InvoiceIn, req: Request, u: User = Depends(REC), db=Depends(get_db)):
    pt = db.get(Patient, b.patient_id)
    if not pt or not pt.active:
        raise err(404, "PATIENT_NOT_FOUND", "Active patient not found.")

    total = b.consultation_fee + b.extra_fee
    inv = Invoice(
        patient_id=b.patient_id,
        consultation_fee=b.consultation_fee,
        extra_fee=b.extra_fee,
        total=total,
        paid=0.0,
        status="Unpaid"
    )
    db.add(inv)
    db.flush()
    audit(db, u, "INVOICE_CREATED", f"inv_id={inv.id}, patient={pt.id}, total={total}", req)
    db.commit()

    return {
        **row_dict(inv),
        "patient_name": pt.full_name,
        "patient_code": pt.patient_code
    }


@app.get("/api/invoices/{iid}")
def get_invoice(iid: int, u: User = Depends(REC), db=Depends(get_db)):
    r = db.execute(
        select(Invoice, Patient.full_name, Patient.patient_code, Patient.phone, Patient.address)
        .join(Patient, Invoice.patient_id == Patient.id)
        .where(Invoice.id == iid)
    ).first()
    if not r:
        raise err(404, "NOT_FOUND", "Invoice not found.")

    inv, p_name, p_code, p_phone, p_address = r
    payments = [row_dict(pm) for pm in db.scalars(
        select(Payment).where(Payment.invoice_id == inv.id).order_by(Payment.created_at.desc())
    ).all()]

    return {
        **row_dict(inv),
        "patient_name": p_name,
        "patient_code": p_code,
        "patient_phone": p_phone,
        "patient_address": p_address,
        "payments": payments,
        "balance_due": max(0.0, inv.total - inv.paid)
    }


@app.post("/api/invoices/{iid}/payments", status_code=201)
def record_payment(iid: int, b: s.PaymentIn, req: Request, u: User = Depends(REC), db=Depends(get_db)):
    inv = db.get(Invoice, iid)
    if not inv:
        raise err(404, "NOT_FOUND", "Invoice not found.")

    balance_due = inv.total - inv.paid
    if balance_due <= 0:
        raise err(400, "ALREADY_PAID", "This invoice is already fully paid.")

    if b.amount > balance_due + 0.01:
        raise err(400, "EXCESS_AMOUNT", f"Payment amount ({b.amount}) exceeds outstanding balance ({balance_due:.2f}).")

    payment = Payment(
        invoice_id=iid,
        amount=b.amount,
        method=b.method
    )
    db.add(payment)

    inv.paid += b.amount
    if inv.paid >= inv.total - 0.01:
        inv.status = "Paid"
    else:
        inv.status = "Partial"

    audit(db, u, "PAYMENT_RECORDED", f"payment_id={payment.id}, inv={iid}, amount={b.amount}, method={b.method}", req)
    db.commit()

    return {
        **row_dict(payment),
        "new_invoice_status": inv.status,
        "total_paid": inv.paid,
        "balance_due": max(0.0, inv.total - inv.paid)
    }


# ---------- Audit Logs (Receptionist/Admin) ----------
@app.get("/api/audit-logs")
def list_audit_logs(
    action: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    u: User = Depends(REC),
    db=Depends(get_db)
):
    st = (
        select(AuditLog, User.username)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(desc(AuditLog.created_at))
    )
    if action:
        st = st.where(AuditLog.action == action)

    def fmt_audit(r):
        a, username = r
        return {
            **row_dict(a),
            "username": username or "System / Anonymous"
        }

    return paginate(db, st, AuditLog.id, page, size, fmt_audit)
