from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---------------- Setup ----------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

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


async def get_current_user_optional(request: Request) -> Optional[dict]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            return None
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except Exception:
        return None


async def require_user(request: Request) -> dict:
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(request: Request) -> dict:
    user = await require_user(request)
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


class PersonInput(BaseModel):
    name: str
    gender: Literal["M", "F", "O"]
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    birth_place: Optional[str] = None
    death_place: Optional[str] = None
    bio: Optional[str] = None


class PersonPatch(BaseModel):
    name: Optional[str] = None
    gender: Optional[Literal["M", "F", "O"]] = None
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    birth_place: Optional[str] = None
    death_place: Optional[str] = None
    bio: Optional[str] = None


class RelationshipInput(BaseModel):
    kind: Literal["parent_child", "spouse"]
    a_id: str  # parent (for parent_child) or spouse a
    b_id: str  # child (for parent_child) or spouse b
    wed_date: Optional[str] = None  # only meaningful for spouse; free text (e.g. "1938")


class ChangeSubmit(BaseModel):
    kind: Literal[
        "add_person",
        "edit_person",
        "delete_person",
        "add_relationship",
        "delete_relationship",
    ]
    payload: dict
    note: Optional[str] = None


# ---------------- Auth Routes ----------------
@api.post("/auth/register")
async def register(inp: RegisterInput, response: Response):
    email = inp.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": inp.name,
        "password_hash": hash_password(inp.password),
        "role": "contributor",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "token": token}


@api.post("/auth/login")
async def login(inp: LoginInput, response: Response):
    email = inp.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(request: Request):
    user = await get_current_user_optional(request)
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
def strip_id(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def public_person(p, is_authed: bool):
    """Return person data based on auth status."""
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
async def list_people(request: Request):
    is_authed = bool(await get_current_user_optional(request))
    docs = await db.people.find({}).to_list(2000)
    return [public_person(strip_id(d), is_authed) for d in docs]


@api.get("/people/{person_id}")
async def get_person(person_id: str, request: Request):
    is_authed = bool(await get_current_user_optional(request))
    p = await db.people.find_one({"id": person_id})
    if not p:
        raise HTTPException(404, "Person not found")
    strip_id(p)
    # Full details returned only when authed; guest gets basic
    if is_authed:
        return full_person(p)
    return public_person(p, False)


@api.get("/tree/{person_id}")
async def get_tree(person_id: str, request: Request):
    """Return the focus person plus parents, spouses, children, and siblings."""
    is_authed = bool(await get_current_user_optional(request))
    focus = await db.people.find_one({"id": person_id})
    if not focus:
        raise HTTPException(404, "Person not found")

    # Parents: relationships where kind=parent_child and b_id=focus
    parent_rels = await db.relationships.find({"kind": "parent_child", "b_id": person_id}).to_list(100)
    parent_ids = [r["a_id"] for r in parent_rels]

    # Children: parent_child where a_id=focus
    child_rels = await db.relationships.find({"kind": "parent_child", "a_id": person_id}).to_list(500)
    child_ids = [r["b_id"] for r in child_rels]

    # Spouses: spouse relationships involving focus (also capture wed_date)
    spouse_rels = await db.relationships.find(
        {"kind": "spouse", "$or": [{"a_id": person_id}, {"b_id": person_id}]}
    ).to_list(20)
    spouse_ids = [(r["b_id"] if r["a_id"] == person_id else r["a_id"]) for r in spouse_rels]
    spouse_wed_dates = {
        (r["b_id"] if r["a_id"] == person_id else r["a_id"]): r.get("wed_date")
        for r in spouse_rels
    }

    # Siblings: other children of any parent
    sibling_ids = set()
    if parent_ids:
        sib_rels = await db.relationships.find(
            {"kind": "parent_child", "a_id": {"$in": parent_ids}}
        ).to_list(500)
        for r in sib_rels:
            if r["b_id"] != person_id:
                sibling_ids.add(r["b_id"])

    # Also fetch spouses of children (so children show with their partners)
    child_spouse_map = {}
    child_spouse_wed_dates = {}  # key: "{child_id}:{spouse_id}" -> wed_date
    if child_ids:
        cs_rels = await db.relationships.find(
            {"kind": "spouse", "$or": [{"a_id": {"$in": child_ids}}, {"b_id": {"$in": child_ids}}]}
        ).to_list(500)
        for r in cs_rels:
            wd = r.get("wed_date")
            if r["a_id"] in child_ids:
                child_spouse_map.setdefault(r["a_id"], []).append(r["b_id"])
                child_spouse_wed_dates[f"{r['a_id']}:{r['b_id']}"] = wd
            if r["b_id"] in child_ids:
                child_spouse_map.setdefault(r["b_id"], []).append(r["a_id"])
                child_spouse_wed_dates[f"{r['b_id']}:{r['a_id']}"] = wd

    # Parents' marriage date (between the two known parents)
    parents_wed_date = None
    if len(parent_ids) >= 2:
        pw = await db.relationships.find_one({
            "kind": "spouse",
            "$or": [
                {"a_id": parent_ids[0], "b_id": parent_ids[1]},
                {"a_id": parent_ids[1], "b_id": parent_ids[0]},
            ],
        })
        if pw:
            parents_wed_date = pw.get("wed_date")

    all_ids = set(parent_ids) | set(child_ids) | set(spouse_ids) | sibling_ids | {person_id}
    for lst in child_spouse_map.values():
        all_ids.update(lst)

    people_docs = await db.people.find({"id": {"$in": list(all_ids)}}).to_list(2000)
    people_map = {p["id"]: public_person(strip_id(p), is_authed) for p in people_docs}

    # Group children by co-parent to build partnerships.
    # For each child of focus, find their other parents (excluding focus).
    child_coparents = {}
    if child_ids:
        all_pc = await db.relationships.find(
            {"kind": "parent_child", "b_id": {"$in": child_ids}}
        ).to_list(2000)
        for r in all_pc:
            if r["a_id"] != person_id:
                child_coparents.setdefault(r["b_id"], []).append(r["a_id"])

    partnerships = []
    matched_children = set()
    for sp_id in spouse_ids:
        kids = [cid for cid in child_ids if sp_id in child_coparents.get(cid, [])]
        partnerships.append({
            "partner": people_map.get(sp_id),
            "children": [people_map[cid] for cid in kids if cid in people_map],
        })
        matched_children.update(kids)

    # Children whose co-parent isn't a recorded spouse of focus (or unknown)
    unlinked_child_ids = [cid for cid in child_ids if cid not in matched_children]
    if unlinked_child_ids:
        partnerships.append({
            "partner": None,
            "children": [people_map[cid] for cid in unlinked_child_ids if cid in people_map],
        })

    # Ensure at least one partnership entry so the frontend has a stable shape.
    if not partnerships:
        partnerships.append({"partner": None, "children": []})

    return {
        "focus": people_map.get(person_id),
        "parents": [people_map[i] for i in parent_ids if i in people_map],
        "spouses": [people_map[i] for i in spouse_ids if i in people_map],
        "children": [people_map[i] for i in child_ids if i in people_map],
        "siblings": [people_map[i] for i in sibling_ids if i in people_map],
        "child_spouses": {cid: [people_map[i] for i in sids if i in people_map] for cid, sids in child_spouse_map.items()},
        "partnerships": partnerships,
        "spouse_wed_dates": spouse_wed_dates,
        "child_spouse_wed_dates": child_spouse_wed_dates,
        "parents_wed_date": parents_wed_date,
        "is_authed": is_authed,
    }


@api.get("/tree/root/default")
async def get_default_root(request: Request):
    """Return the root person (earliest ancestor) - one with no parent relationship."""
    root_doc = await db.meta.find_one({"key": "root_person_id"})
    if root_doc:
        return {"person_id": root_doc["value"]}
    # Fallback: find first person with no parent relationship
    all_people = await db.people.find({}).to_list(2000)
    parents_with_children = await db.relationships.distinct("b_id", {"kind": "parent_child"})
    for p in all_people:
        if p["id"] not in parents_with_children:
            return {"person_id": p["id"]}
    if all_people:
        return {"person_id": all_people[0]["id"]}
    raise HTTPException(404, "No people in tree")


# ---------------- Change Proposal Routes ----------------
@api.post("/changes")
async def submit_change(inp: ChangeSubmit, request: Request):
    user = await require_user(request)
    change = {
        "id": str(uuid.uuid4()),
        "kind": inp.kind,
        "payload": inp.payload,
        "note": inp.note,
        "submitted_by": {"id": user["id"], "email": user["email"], "name": user.get("name", "")},
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.changes.insert_one(change)
    return {"id": change["id"], "status": "pending"}


@api.get("/admin/changes")
async def list_changes(request: Request, status: str = "pending"):
    await require_admin(request)
    docs = await db.changes.find({"status": status}).sort("created_at", -1).to_list(500)
    return [strip_id(d) for d in docs]


@api.get("/admin/changes/count")
async def count_pending(request: Request):
    await require_admin(request)
    n = await db.changes.count_documents({"status": "pending"})
    return {"pending": n}


async def apply_change(change: dict):
    """Apply an approved change to the tree."""
    kind = change["kind"]
    payload = change["payload"]
    if kind == "add_person":
        new_id = str(uuid.uuid4())
        person = {
            "id": new_id,
            "name": payload.get("name", "Unknown"),
            "gender": payload.get("gender", "O"),
            "birth_date": payload.get("birth_date"),
            "death_date": payload.get("death_date"),
            "birth_place": payload.get("birth_place"),
            "death_place": payload.get("death_place"),
            "bio": payload.get("bio"),
        }
        await db.people.insert_one(person)
        # Optional: attach to an existing person via parent_id or spouse_id
        if payload.get("parent_id"):
            await db.relationships.insert_one({
                "id": str(uuid.uuid4()),
                "kind": "parent_child",
                "a_id": payload["parent_id"],
                "b_id": new_id,
            })
        if payload.get("child_id"):
            await db.relationships.insert_one({
                "id": str(uuid.uuid4()),
                "kind": "parent_child",
                "a_id": new_id,
                "b_id": payload["child_id"],
            })
        if payload.get("spouse_id"):
            await db.relationships.insert_one({
                "id": str(uuid.uuid4()),
                "kind": "spouse",
                "a_id": new_id,
                "b_id": payload["spouse_id"],
            })
        return {"new_person_id": new_id}
    elif kind == "edit_person":
        pid = payload["id"]
        updates = {k: v for k, v in payload.items() if k != "id" and v is not None}
        if updates:
            await db.people.update_one({"id": pid}, {"$set": updates})
        return {"updated": pid}
    elif kind == "delete_person":
        pid = payload["id"]
        await db.people.delete_one({"id": pid})
        await db.relationships.delete_many({"$or": [{"a_id": pid}, {"b_id": pid}]})
        return {"deleted": pid}
    elif kind == "add_relationship":
        rel = {
            "id": str(uuid.uuid4()),
            "kind": payload["kind"],
            "a_id": payload["a_id"],
            "b_id": payload["b_id"],
        }
        if payload.get("wed_date"):
            rel["wed_date"] = payload["wed_date"]
        await db.relationships.insert_one(rel)
        return {"new_rel_id": rel["id"]}
    elif kind == "delete_relationship":
        rid = payload["id"]
        await db.relationships.delete_one({"id": rid})
        return {"deleted": rid}
    raise HTTPException(400, f"Unknown change kind {kind}")


@api.post("/admin/changes/{change_id}/approve")
async def approve_change(change_id: str, request: Request):
    admin = await require_admin(request)
    change = await db.changes.find_one({"id": change_id})
    if not change:
        raise HTTPException(404, "Change not found")
    if change["status"] != "pending":
        raise HTTPException(400, "Change already processed")
    result = await apply_change(change)
    await db.changes.update_one(
        {"id": change_id},
        {"$set": {"status": "approved", "reviewed_by": admin["email"], "reviewed_at": datetime.now(timezone.utc).isoformat(), "result": result}},
    )
    return {"ok": True, "result": result}


@api.post("/admin/changes/{change_id}/reject")
async def reject_change(change_id: str, request: Request, body: dict = None):
    admin = await require_admin(request)
    change = await db.changes.find_one({"id": change_id})
    if not change:
        raise HTTPException(404, "Change not found")
    if change["status"] != "pending":
        raise HTTPException(400, "Change already processed")
    reason = (body or {}).get("reason") if body else None
    await db.changes.update_one(
        {"id": change_id},
        {"$set": {"status": "rejected", "reviewed_by": admin["email"], "reviewed_at": datetime.now(timezone.utc).isoformat(), "reject_reason": reason}},
    )
    return {"ok": True}


# ---------------- Admin direct edit (bypass approval) ----------------
@api.post("/admin/people")
async def admin_create_person(inp: PersonInput, request: Request):
    await require_admin(request)
    person = {
        "id": str(uuid.uuid4()),
        **inp.model_dump(),
    }
    await db.people.insert_one(person)
    return strip_id(person)


@api.patch("/admin/people/{person_id}")
async def admin_update_person(person_id: str, inp: PersonPatch, request: Request):
    await require_admin(request)
    updates = {k: v for k, v in inp.model_dump().items() if v is not None}
    if updates:
        await db.people.update_one({"id": person_id}, {"$set": updates})
    p = await db.people.find_one({"id": person_id})
    return strip_id(p)


@api.delete("/admin/people/{person_id}")
async def admin_delete_person(person_id: str, request: Request):
    await require_admin(request)
    await db.people.delete_one({"id": person_id})
    await db.relationships.delete_many({"$or": [{"a_id": person_id}, {"b_id": person_id}]})
    return {"ok": True}


@api.post("/admin/relationships")
async def admin_create_rel(inp: RelationshipInput, request: Request):
    await require_admin(request)
    rel = {"id": str(uuid.uuid4()), **inp.model_dump()}
    await db.relationships.insert_one(rel)
    return strip_id(rel)


@api.delete("/admin/relationships/{rel_id}")
async def admin_delete_rel(rel_id: str, request: Request):
    await require_admin(request)
    await db.relationships.delete_one({"id": rel_id})
    return {"ok": True}


@api.get("/")
async def root():
    return {"message": "Puskarcik Family Tree API"}


# ---------------- Seed ----------------
async def seed():
    # Admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@puskarcik.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_pw),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    await db.users.create_index("email", unique=True)
    await db.people.create_index("id", unique=True)
    await db.relationships.create_index([("a_id", 1), ("b_id", 1), ("kind", 1)])
    await db.changes.create_index("status")

    # Seed Puskarcik family if empty
    if await db.people.count_documents({}) == 0:
        def mk(name, gender, **kw):
            return {"id": str(uuid.uuid4()), "name": name, "gender": gender, **kw}

        ludwig = mk("Ludwig Puskarczyk", "M", birth_date="c. 1870", death_date="Unknown",
                    birth_place="Poland", bio="Patriarch of the Puskarczyk family; emigrated from Poland.")
        aniela = mk("Aniela Malek", "F", birth_date="c. 1875", death_date="Unknown",
                    birth_place="Poland", bio="Matriarch of the Puskarczyk family.")

        chester = mk("Chester Puskarcik", "M", birth_date="1895", death_date="1970", bio="Son of Ludwig & Aniela.")
        vera = mk("Vera", "F", birth_date="1900", death_date="1975", bio="Wife of Chester Puskarcik.")

        helen = mk("Helen Puskarcik", "F", birth_date="1898", death_date="1980", bio="Daughter of Ludwig & Aniela.")
        michael = mk("Michael Cvengros", "M", birth_date="1895", death_date="1972", bio="Husband of Helen.")

        lottie = mk("Lottie Puskarcik", "F", birth_date="1900", death_date="1985", bio="Daughter of Ludwig & Aniela.")
        philip = mk("Philip Houser", "M", birth_date="1898", death_date="1980", bio="Husband of Lottie.")

        jean = mk("Jean Puskarcik", "F", birth_date="1902", death_date="1988", bio="Daughter of Ludwig & Aniela.")
        joseph = mk("Joseph Gromada", "M", birth_date="1900", death_date="1985", bio="Husband of Jean.")

        stephanie = mk("Stephanie Puskarcik", "F", birth_date="1904", death_date="1990", bio="Daughter of Ludwig & Aniela.")
        carl = mk("Carl John Puskarcik", "M", birth_date="1906", death_date="1985",
                  bio="Son of Ludwig & Aniela.")
        helen_d = mk("Helen Dubaj", "F", birth_date="1910", death_date="1992", bio="Wife of Carl John.")

        stasia = mk("Stasia (Tunny) Puskarcik", "F", birth_date="1908", death_date="1990", bio="Daughter of Ludwig & Aniela.")
        george = mk("George Sertich", "M", birth_date="1905", death_date="1988", bio="Husband of Stasia.")

        thaddeus = mk("Thaddeus Robert Puskarcik", "M", birth_date="1912", death_date="1995",
                      bio="Son of Ludwig & Aniela.")
        tillie = mk("Tillie Theresa Marie Balogh", "F", birth_date="1915", death_date="1998",
                    bio="Wife of Thaddeus Robert.")

        all_people = [ludwig, aniela, chester, vera, helen, michael, lottie, philip,
                      jean, joseph, stephanie, carl, helen_d, stasia, george, thaddeus, tillie]
        await db.people.insert_many(all_people)

        await db.meta.update_one({"key": "root_person_id"}, {"$set": {"value": ludwig["id"]}}, upsert=True)

        rels = []
        def rel(kind, a, b):
            rels.append({"id": str(uuid.uuid4()), "kind": kind, "a_id": a, "b_id": b})

        # Spouses (top generation)
        rel("spouse", ludwig["id"], aniela["id"])
        # Children of Ludwig & Aniela
        for child in [chester, helen, lottie, jean, stephanie, carl, stasia, thaddeus]:
            rel("parent_child", ludwig["id"], child["id"])
            rel("parent_child", aniela["id"], child["id"])
        # Marriages
        rel("spouse", chester["id"], vera["id"])
        rel("spouse", helen["id"], michael["id"])
        rel("spouse", lottie["id"], philip["id"])
        rel("spouse", jean["id"], joseph["id"])
        rel("spouse", carl["id"], helen_d["id"])
        rel("spouse", stasia["id"], george["id"])
        rel("spouse", thaddeus["id"], tillie["id"])

        await db.relationships.insert_many(rels)

    # Write test credentials
    creds_path = Path("/app/memory")
    creds_path.mkdir(parents=True, exist_ok=True)
    (creds_path / "test_credentials.md").write_text(
        f"""# Test Credentials

## Admin
- Email: {admin_email}
- Password: {admin_pw}
- Role: admin

## Test Contributor (create via register endpoint)
- Email: contributor@example.com
- Password: contrib123
- Role: contributor (default on register)

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
"""
    )


@app.on_event("startup")
async def startup():
    await seed()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
