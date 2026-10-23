from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
import mysql.connector

# ---------------- Setup & MariaDB Connection ----------------
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 3306))
DB_NAME = os.environ.get("DB_NAME", "puskarcik_db")
DB_USER = os.environ.get("DB_USER", "puskarcik_user")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "puskarcik_pass123")

def get_db():
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )

def fetch_all(query: str, params: tuple = ()):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def fetch_one(query: str, params: tuple = ()):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query, params)
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row

def execute_query(query: str, params: tuple = ()):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    conn.commit()
    cursor.close()
    conn.close()

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "local_development_secret_key_123")

app = FastAPI(title="Puskarcik Family Tree API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- Auth Helpers ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user_optional(request: Request) -> Optional[dict]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = fetch_one("SELECT * FROM users WHERE id = %s", (payload["sub"],))
        if user:
            user.pop("password_hash", None)
        return user
    except Exception:
        return None

def require_user(request: Request) -> dict:
    user = get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_admin(request: Request) -> dict:
    user = require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 3600,
        path="/",
    )

# ---------------- Models ----------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class LoginInput(BaseModel):
    email: EmailStr
    password: str

# ---------------- Auth Routes ----------------
@api.post("/auth/register")
def register(inp: RegisterInput, response: Response):
    email = inp.email.lower()
    if fetch_one("SELECT id FROM users WHERE email = %s", (email,)):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    uid = str(uuid.uuid4())
    pw_hash = hash_password(inp.password)
    created_at = datetime.now(timezone.utc).isoformat()
    
    execute_query(
        "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
        (uid, email, inp.name, pw_hash, "contributor", created_at)
    )
    
    token = create_access_token(uid, email, "contributor")
    set_auth_cookie(response, token)
    return {"id": uid, "email": email, "name": inp.name, "role": "contributor", "token": token}

@api.post("/auth/login")
def login(inp: LoginInput, response: Response):
    email = inp.email.lower()
    user = fetch_one("SELECT * FROM users WHERE email = %s", (email,))
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "token": token}

@api.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
@api.get("/users/me")
def me(request: Request):
    user = get_current_user_optional(request)
    if not user:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "contributor"),
    }

# ---------------- People / Tree Routes ----------------
def public_person(p, is_authed: bool):
    if not p:
        return None
    base = {"id": p["id"], "name": p["name"], "gender": p.get("gender", "O")}
    if is_authed:
        base.update({
            "birth_date": p.get("birth_date"),
            "death_date": p.get("death_date"),
        })
    return base

def full_person(p):
    if not p:
        return None
    return {
        "id": p["id"],
        "name": p["name"],
        "gender": p.get("gender", "O"),
        "birth_date": p.get("birth_date"),
        "death_date": p.get("death_date"),
        "birth_place": p.get("birth_place"),
        "death_place": p.get("death_place"),
        "bio": p.get("bio"),
    }

@api.get("/people")
def list_people(request: Request):
    is_authed = bool(get_current_user_optional(request))
    docs = fetch_all("SELECT * FROM people")
    return [public_person(d, is_authed) for d in docs]

@api.get("/people/{person_id}")
def get_person(person_id: str, request: Request):
    is_authed = bool(get_current_user_optional(request))
    p = fetch_one("SELECT * FROM people WHERE id = %s", (person_id,))
    if not p:
        raise HTTPException(404, "Person not found")
    if is_authed:
        return full_person(p)
    return public_person(p, False)

@api.get("/tree/{person_id}")
def get_tree(person_id: str, request: Request):
    is_authed = bool(get_current_user_optional(request))
    focus = fetch_one("SELECT * FROM people WHERE id = %s", (person_id,))
    if not focus:
        raise HTTPException(404, "Person not found")

    parent_rels = fetch_all("SELECT a_id FROM relationships WHERE kind = 'parent_child' AND b_id = %s", (person_id,))
    parent_ids = [r["a_id"] for r in parent_rels]

    child_rels = fetch_all("SELECT b_id FROM relationships WHERE kind = 'parent_child' AND a_id = %s", (person_id,))
    child_ids = [r["b_id"] for r in child_rels]

    spouse_rels = fetch_all("SELECT a_id, b_id, wed_date FROM relationships WHERE kind = 'spouse' AND (a_id = %s OR b_id = %s)", (person_id, person_id))
    spouse_ids = [(r["b_id"] if r["a_id"] == person_id else r["a_id"]) for r in spouse_rels]
    spouse_wed_dates = {(r["b_id"] if r["a_id"] == person_id else r["a_id"]): r.get("wed_date") for r in spouse_rels}

    sibling_ids = set()
    if parent_ids:
        format_strings = ','.join(['%s'] * len(parent_ids))
        sib_rels = fetch_all(f"SELECT b_id FROM relationships WHERE kind = 'parent_child' AND a_id IN ({format_strings})", tuple(parent_ids))
        for r in sib_rels:
            if r["b_id"] != person_id:
                sibling_ids.add(r["b_id"])

    all_ids = set(parent_ids) | set(child_ids) | set(spouse_ids) | sibling_ids | {person_id}
    format_strings = ','.join(['%s'] * len(all_ids))
    people_docs = fetch_all(f"SELECT * FROM people WHERE id IN ({format_strings})", tuple(all_ids))
    people_map = {p["id"]: public_person(p, is_authed) for p in people_docs}

    return {
        "focus": people_map.get(person_id),
        "parents": [people_map[i] for i in parent_ids if i in people_map],
        "spouses": [people_map[i] for i in spouse_ids if i in people_map],
        "children": [people_map[i] for i in child_ids if i in people_map],
        "siblings": [people_map[i] for i in sibling_ids if i in people_map],
        "spouse_wed_dates": spouse_wed_dates,
        "is_authed": is_authed,
    }

@api.get("/tree/root/default")
@api.get("/tree/default")
def get_default_tree():
    # Just fetch the first person in the database as root
    person = fetch_one("SELECT id FROM people LIMIT 1")
    if not person:
        raise HTTPException(status_code=404, detail="No people in database")
    return {"person_id": person["id"]}

@api.get("/")
def root():
    return {"message": "Puskarcik Family Tree API"}

# ---------------- MariaDB Schema & Seed Initialization ----------------
def seed():
    # 1. Create required database tables if they do not exist
    execute_query("""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            created_at VARCHAR(100)
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS people (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            gender CHAR(1) DEFAULT 'O',
            birth_date VARCHAR(100),
            death_date VARCHAR(100),
            birth_place VARCHAR(255),
            death_place VARCHAR(255),
            bio TEXT
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS relationships (
            id VARCHAR(64) PRIMARY KEY,
            kind VARCHAR(50) NOT NULL,
            a_id VARCHAR(64) NOT NULL,
            b_id VARCHAR(64) NOT NULL,
            wed_date VARCHAR(100)
        )
    """)

    # 2. Seed Admin User
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@puskarcik.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing_admin = fetch_one("SELECT id FROM users WHERE email = %s", (admin_email,))
    if not existing_admin:
        execute_query(
            "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), admin_email, "Admin", hash_password(admin_pw), "admin", datetime.now(timezone.utc).isoformat())
        )

    # 3. Seed Puskarcik Family if people table is empty
    count_res = fetch_one("SELECT COUNT(*) AS total FROM people")
    if count_res and count_res["total"] == 0:
        logger.info("Seeding initial Puskarcik family records into MariaDB...")

        def mk(name, gender, birth_date=None, death_date=None, birth_place=None, bio=None):
            pid = str(uuid.uuid4())
            execute_query(
                "INSERT INTO people (id, name, gender, birth_date, death_date, birth_place, bio) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (pid, name, gender, birth_date, death_date, birth_place, bio)
            )
            return pid

        ludwig = mk("Ludwig Puskarczyk", "M", birth_date="c. 1870", birth_place="Poland", bio="Patriarch of the Puskarczyk family.")
        aniela = mk("Aniela Malek", "F", birth_date="c. 1875", birth_place="Poland", bio="Matriarch of the Puskarczyk family.")
        chester = mk("Chester Puskarcik", "M", birth_date="1895", death_date="1970")
        vera = mk("Vera", "F", birth_date="1900", death_date="1975")
        helen = mk("Helen Puskarcik", "F", birth_date="1898", death_date="1980")
        michael = mk("Michael Cvengros", "M", birth_date="1895", death_date="1972")

        def rel(kind, a, b):
            execute_query("INSERT INTO relationships (id, kind, a_id, b_id) VALUES (%s, %s, %s, %s)", (str(uuid.uuid4()), kind, a, b))

        rel("spouse", ludwig, aniela)
        rel("parent_child", ludwig, chester)
        rel("parent_child", aniela, chester)
        rel("parent_child", ludwig, helen)
        rel("parent_child", aniela, helen)
        rel("spouse", chester, vera)
        rel("spouse", helen, michael)

# Define the lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Code here runs on STARTUP ---
    seed()
    yield
    # --- Code here runs on SHUTDOWN (if needed) ---

# Initialize FastAPI with the lifespan handler
app = FastAPI(title="Puskarcik Family Tree API", lifespan=lifespan)


def startup():
    seed()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
