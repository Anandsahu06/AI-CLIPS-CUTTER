import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variable or default to SQLite database in the frontend/prisma folder
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../frontend/prisma/dev.db")

# Convert Prisma-style 'file:' URL to SQLAlchemy-compatible 'sqlite:///' URL
if DATABASE_URL.startswith("file:"):
    db_path = DATABASE_URL.replace("file:", "", 1)
    # Ensure absolute path prefix formatting is correct
    DATABASE_URL = f"sqlite:///{db_path}"


# Handle differences between SQLite and PostgreSQL parameters
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get db session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        # Enable WAL mode for SQLite to prevent locking when accessed by Next.js and FastAPI
        if DATABASE_URL.startswith("sqlite"):
            db.execute(text("PRAGMA journal_mode=WAL;"))
        yield db
    finally:
        db.close()
