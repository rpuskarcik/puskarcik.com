# Regression tests for GET /api/tree-data (renderFamilyTree input) + admin add-person refresh
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "admin@puskarcik.com", "password": "admin123"}


@pytest.fixture(scope="module")
def anon():
    return requests.Session()


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    return s


# --- tree-data shape (anonymous) ---
def test_tree_data_anon_shape(anon):
    r = anon.get(f"{BASE_URL}/api/tree-data")
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["root_id"], str)
    assert isinstance(d["people"], list) and len(d["people"]) > 10
    ids = {p["id"] for p in d["people"]}
    assert d["root_id"] in ids
    for p in d["people"]:
        assert "_id" not in p
        assert set(["id", "name", "gender", "parents", "spouses"]).issubset(p)
        assert "birth_date" not in p and "bio" not in p  # anon hides dates


def test_tree_data_root_is_ludwig_with_aniela_and_9_children(anon):
    d = anon.get(f"{BASE_URL}/api/tree-data").json()
    by = {p["id"]: p for p in d["people"]}
    root = by[d["root_id"]]
    assert "Ludwig" in root["name"]
    children = [p for p in d["people"] if root["id"] in p["parents"]]
    assert len(children) == 9
    spouse_ids = {s["id"] for s in root["spouses"]} | {
        p["id"] for p in d["people"] if any(s["id"] == root["id"] for s in p["spouses"])
    }
    assert any("Aniela" in by[i]["name"] for i in spouse_ids)


def test_tree_data_refs_valid(anon):
    d = anon.get(f"{BASE_URL}/api/tree-data").json()
    ids = {p["id"] for p in d["people"]}
    for p in d["people"]:
        for pid in p["parents"]:
            assert pid in ids
        for s in p["spouses"]:
            assert s["id"] in ids


# --- tree-data authed shows dates ---
def test_tree_data_authed_has_dates(admin):
    d = admin.get(f"{BASE_URL}/api/tree-data").json()
    assert any(p.get("birth_date") for p in d["people"])
    assert all("bio" in p for p in d["people"])


# --- add person + relationship -> tree-data reflects it ---
def test_admin_add_person_reflected_in_tree_data(admin):
    d = admin.get(f"{BASE_URL}/api/tree-data").json()
    root_id = d["root_id"]
    name = f"TEST_Child_{uuid.uuid4().hex[:6]}"
    r = admin.post(f"{BASE_URL}/api/admin/people", json={"name": name, "gender": "M"})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    try:
        rr = admin.post(f"{BASE_URL}/api/admin/relationships",
                        json={"kind": "parent_child", "a_id": root_id, "b_id": pid})
        assert rr.status_code == 200, rr.text
        d2 = admin.get(f"{BASE_URL}/api/tree-data").json()
        p = next(x for x in d2["people"] if x["id"] == pid)
        assert p["name"] == name and root_id in p["parents"]
    finally:
        admin.delete(f"{BASE_URL}/api/admin/people/{pid}")
    d3 = admin.get(f"{BASE_URL}/api/tree-data").json()
    assert pid not in {x["id"] for x in d3["people"]}
