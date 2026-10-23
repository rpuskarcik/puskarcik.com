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

## Implemented (Jun 2026) — Modular renderer
- `renderFamilyTree(container, peopleArray, options)` in `frontend/src/familyTree/` is the single entry point. It doesn't depend on any database. Docs are in `familyTree/README.md`
- Pure `buildTree(people, focusId)` builds the view model on the client. `sampleData.js` is a snapshot of the DB
- `GET /api/tree-data` returns `{root_id, people[]}` in the renderer format. TreePage uses it, and `/demo` renders from static data
- Supports marriage `end_date` (label "1942 – 1968")

## Implemented (Jun 2026) — Plain HTML embed
- `public/embed/family-tree.js` is a single ~200 KB script that bundles React and the styles (scoped to `.ft-root`). Call it with `FamilyTree.render(el|selector, peopleArray, options)`
- Example page: `/embed/example.html`. Rebuild with `yarn build:embed` (`scripts/build-embed.js`, esbuild + Tailwind)
- Fixes: marriage hover zones no longer block clicks on cards, the resize handler no longer uses stale data, and the lines re-measure after fonts load (ResizeObserver)

## Implemented (Jun 2026) — puskarcik.com install kit
- `/embed/puskarcik-kit.zip` (also unzipped at `/embed/puskarcik-kit/`) contains `index.html`, `people.js`, `family-tree.js` and `INSTALL.txt`
- `index.html` is the user's live page with the same header and photo; the old `.node` tree, the global `svg {}` CSS and the resize script were replaced by `FamilyTree.render`
- `people.js` uses the REAL dates from puskarcik.com, which differ from the placeholder dates in the app DB. Chester, Carl and Thaddeus have `link` fields, shown in the detail window as "Read more →"
- On narrow screens the focus row uses `safe center`, so the top card is no longer clipped

## Implemented (Jun 2026) — Wedding date slots (kit only)
- The user gave no dates. Each of the 8 couples in the kit's `people.js` has an empty `"wed_date": ""` / `"end_date": ""` slot. An empty slot means no tooltip
- `INSTALL.txt` now has an "ADDING WEDDING DATES" section, and the zip was rebuilt. The app DB is unchanged, as the user chose

## Backlog (P1/P2)
- Sync the app DB with the real dates from puskarcik.com
- Pencil edit affordance on hover of any node
- Undo recent delete (admin), CSV/GEDCOM import, grandchildren peek
- Email notification to admin on new submission (currently in-app only)
- Delete person / delete relationship UI in contributor portal
- Public person profile sub-pages (like /chester on original site)
- Photo uploads per person (Object Storage)
- Search / find-person bar
- Timeline/genealogy export (GEDCOM)
