import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///./clinic.db"), connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(engine, autoflush=False)


@event.listens_for(engine, "connect")
def _fk_on(conn, _):
    conn.execute("PRAGMA foreign_keys=ON")


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as db:
        yield db
