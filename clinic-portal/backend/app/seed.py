"""Idempotent seed: python -m app.seed  (use --reset to wipe and reseed)"""
import os, random, sys
from datetime import date, datetime, time, timedelta
from faker import Faker
from sqlalchemy import func, select
from .db import Base, SessionLocal, engine
from .models import (Appointment, AuditLog, Consultation, Doctor, Invoice, Patient, Payment, Prescription,
                     Receptionist, User)
from .security import hash_password

SPECS = ["General Medicine", "Cardiology", "Pediatrics", "Orthopedics", "Dermatology", "ENT", "Neurology",
         "Gynecology", "Ophthalmology", "Endocrinology"]
CONDITIONS = ["", "Hypertension", "Type 2 Diabetes", "Asthma", "Hypothyroidism", "Migraine", "Arthritis", "Anemia"]
ALLERGIES = ["", "Penicillin", "Peanuts", "Dust", "Sulfa drugs", "Shellfish", "Pollen", "Latex"]
DRUGS = [("Paracetamol", "500 mg"), ("Amoxicillin", "250 mg"), ("Cetirizine", "10 mg"), ("Metformin", "500 mg"),
         ("Amlodipine", "5 mg"), ("Pantoprazole", "40 mg"), ("Ibuprofen", "400 mg"), ("Azithromycin", "500 mg")]
REASONS = ["Fever and cold", "Routine check-up", "Back pain", "Skin rash", "Headache", "Follow-up visit",
           "Stomach pain", "Blood pressure review", "Cough", "Joint pain"]
ACTIONS = ["LOGIN", "LOGOUT", "PATIENT_VIEWED", "PATIENT_CREATED", "APPOINTMENT_CREATED", "LOGIN_FAILED", "EXPORT_COMPLETED"]
PASSWORDS = {"doctor": "Doctor@123", "receptionist": "Reception@123"}


def run(reset=False):
    if reset and os.path.exists("clinic.db"):
        engine.dispose(); os.remove("clinic.db")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            print("Already seeded - nothing to do."); return
        random.seed(7); Faker.seed(7); fake = Faker("en_IN"); today = date.today()
        docs, recs = [], []
        for i in range(1, 11):
            u = User(username=f"doctor{i}", password_hash=hash_password(PASSWORDS["doctor"]), role="doctor", full_name="Dr. " + fake.name())
            db.add(u); db.flush(); d = Doctor(user_id=u.id, specialization=SPECS[i - 1]); db.add(d); docs.append(d)
        for i in range(1, 6):
            u = User(username=f"reception{i}", password_hash=hash_password(PASSWORDS["receptionist"]), role="receptionist", full_name=fake.name())
            db.add(u); db.flush(); db.add(Receptionist(user_id=u.id, desk=f"Desk {i}")); recs.append(u)
        patients = []
        for i in range(1, 201):
            g = random.choice(["Male", "Female"])
            p = Patient(patient_code=f"PT{i:06d}", full_name=fake.name_male() if g == "Male" else fake.name_female(),
                        dob=today - timedelta(days=random.randint(365, 90 * 365)), gender=g,
                        phone=f"+91 {random.choice('6789')}{random.randint(10**8, 10**9 - 1)}",
                        email=fake.email() if random.random() < .8 else None,
                        address=fake.address().replace("\n", ", ")[:240], blood_group=random.choice(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
                        emergency_contact=f"{fake.name()} ({random.choice(['Spouse', 'Parent', 'Sibling', 'Child'])}) +91 {random.choice('6789')}{random.randint(10**8, 10**9 - 1)}",
                        allergies=random.choice(ALLERGIES), conditions=random.choice(CONDITIONS),
                        registered_on=today - timedelta(days=random.randint(0, 720)))
            db.add(p); patients.append(p)
        db.flush()
        appts, taken = [], set()
        while len(appts) < 300:
            d, pt = random.choice(docs), random.choice(patients)
            when = datetime.combine(today + timedelta(days=random.randint(-60, 14)), time(random.randint(9, 17), random.choice([0, 15, 30, 45])))
            if (d.id, when) in taken: continue
            taken.add((d.id, when))
            if when.date() < today: st = random.choices(["Completed", "Cancelled"], [85, 15])[0]
            elif when.date() == today: st = random.choice(["Scheduled", "Checked In", "Waiting", "In Consultation", "Completed", "Cancelled"])
            else: st = "Scheduled"
            a = Appointment(patient_id=pt.id, doctor_id=d.id, scheduled_at=when, reason=random.choice(REASONS), status=st)
            db.add(a); appts.append(a)
        db.flush()
        cons = []
        for a in [x for x in appts if x.status == "Completed"][:150]:
            c = Consultation(appointment_id=a.id, patient_id=a.patient_id, doctor_id=a.doctor_id, symptoms=a.reason,
                             diagnosis=random.choice(["Viral infection", "Hypertension", "Gastritis", "Allergic rhinitis", "Muscle strain", "Healthy"]),
                             notes="Advised rest and hydration.", follow_up=a.scheduled_at.date() + timedelta(days=random.choice([7, 14, 30])) if random.random() < .6 else None)
            db.add(c); cons.append(c)
        db.flush()
        for c in cons:
            m, dose = random.choice(DRUGS)
            db.add(Prescription(consultation_id=c.id, medication=m, dosage=dose, frequency=random.choice(["Once daily", "Twice daily", "Thrice daily"]), duration=random.choice(["3 days", "5 days", "7 days", "14 days"])))
        invoices = []
        for i in range(200):
            pid = cons[i].patient_id if i < len(cons) else random.choice(patients).id
            fee, extra = random.choice([300, 500, 700, 1000]), random.choice([0, 0, 150, 400, 900])
            inv = Invoice(patient_id=pid, consultation_fee=fee, extra_fee=extra, total=fee + extra)
            db.add(inv); invoices.append(inv)
        db.flush()
        for inv in invoices:
            kind = random.choice(["Paid", "Partial", "Unpaid"])
            if kind == "Unpaid": continue
            amt = inv.total if kind == "Paid" else round(inv.total * random.choice([.3, .5, .7]), 2)
            db.add(Payment(invoice_id=inv.id, amount=amt, method=random.choice(["Cash", "Card", "UPI"])))
            inv.paid, inv.status = amt, kind
        users = recs + [None]
        for _ in range(100):
            u = random.choice(users)
            db.add(AuditLog(user_id=u.id if u else None, action=random.choice(ACTIONS), detail="seeded", ip="127.0.0.1",
                            created_at=datetime.utcnow() - timedelta(minutes=random.randint(1, 60 * 24 * 30))))
        db.commit()
        print("Seeded: 200 patients, 10 doctors, 5 receptionists, 300 appointments, 150 consultations/prescriptions, 200 invoices, 100 audit logs.")


if __name__ == "__main__":
    run("--reset" in sys.argv)
