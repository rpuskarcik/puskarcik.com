# Puskarcik Family Tree — PRD

## Problem Statement
A family tree graphic with rounded rectangles and arrows showing the flow (started at https://puskarcik.com/), rebuilt to be modular and database-backed so it can adjust dynamically.

## User Personas
- **Visitor (guest):** Anyone browsing the site. Sees an interactive tree with names + gender symbols. Can click any person to re-center the tree on them.
- **Contributor (registered user):** Anyone with an account. Sees dates on hover, opens detail modal on focused person, and can submit change proposals.
- **Admin / Family Curator:** Approves or rejects contributor submissions via admin panel.

## Core Requirements
- Public interactive family tree, click to re-center
- Logged-in users see birth/death dates on hover, click focused person for detail modal with back button
- User registration/login (JWT via httpOnly cookie + fallback bearer token)
- Contributor portal to propose: add person, edit person, add relationship
- Admin panel: pending queue, approve/reject; approved changes apply automatically to the tree
- Seed data: Ludwig + Aniela Puskarczyk and their 8 children + spouses

## Architecture
- Backend: FastAPI + Motor (MongoDB async). Data model: `people`, `relationships {kind: parent_child|spouse, a_id, b_id}`, `changes {kind, payload, status}`, `users`, `meta`.
- Frontend: React 19 + React Router, Tailwind + shadcn UI, sonner toasts, custom SVG connectors for tree lines.
- Auth: bcrypt + PyJWT, httpOnly `access_token` cookie + Bearer token fallback in localStorage.

## Implemented (Feb 2026)
- Backend: auth (register/login/logout/me), people list/detail, tree fetch centered on any person, changes submit, admin approve/reject, admin direct CRUD
- Frontend: Tree page with re-center, parents/spouse/children/child-spouses rendering with SVG connectors, hover tooltip dates for authed users, detail modal with back-to-previous-tree, login/register, contributor portal (add/edit person + add relationship), admin panel with pending/approved/rejected tabs

## Backlog (P1/P2)
- Email notification to admin on new submission (currently in-app only)
- Delete person / delete relationship UI in contributor portal
- Public person profile sub-pages (like /chester on original site)
- Photo uploads per person (Object Storage)
- Search / find-person bar
- Timeline/genealogy export (GEDCOM)
