// Pure function: flat people array + focus id -> the nested view model FamilyTreeView draws.
const marriageLabel = (s) => {
  if (!s || (!s.wed_date && !s.end_date)) return null;
  return s.end_date ? `${s.wed_date || "?"} – ${s.end_date}` : s.wed_date;
};

export function buildTree(people, focusId) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const focus = byId.get(focusId);
  if (!focus) return null;

  const spouseMap = new Map();
  const addSpouse = (a, b, info) => {
    if (!byId.has(a) || !byId.has(b)) return;
    const list = spouseMap.get(a) || [];
    if (!list.some((s) => s.id === b)) list.push({ ...info, id: b });
    spouseMap.set(a, list);
  };
  people.forEach((p) =>
    (p.spouses || []).forEach((s) => {
      const info = typeof s === "string" ? { id: s } : s;
      addSpouse(p.id, info.id, info);
      addSpouse(info.id, p.id, info);
    })
  );

  const parentsOf = (id) => (byId.get(id)?.parents || []).filter((pid) => byId.has(pid));
  const childrenOf = (id) => people.filter((p) => (p.parents || []).includes(id)).map((p) => p.id);
  const spousesOf = (id) => spouseMap.get(id) || [];
  const get = (id) => byId.get(id);

  const parentIds = parentsOf(focusId);
  const childIds = childrenOf(focusId);
  const focusSpouses = spousesOf(focusId);

  const partnerships = focusSpouses.map((sp) => ({
    partner: get(sp.id),
    children: childIds.filter((cid) => parentsOf(cid).includes(sp.id)).map(get),
  }));
  const matched = new Set(partnerships.flatMap((p) => p.children.map((c) => c.id)));
  const unlinked = childIds.filter((cid) => !matched.has(cid));
  if (unlinked.length || !partnerships.length) {
    partnerships.push({ partner: null, children: unlinked.map(get) });
  }

  const childSpouses = {};
  const childSpouseWed = {};
  childIds.forEach((cid) => {
    const sps = spousesOf(cid);
    if (!sps.length) return;
    childSpouses[cid] = sps.map((s) => get(s.id));
    sps.forEach((s) => (childSpouseWed[`${cid}:${s.id}`] = marriageLabel(s)));
  });

  const parentsMarriage =
    parentIds.length >= 2 ? spousesOf(parentIds[0]).find((s) => s.id === parentIds[1]) : null;

  return {
    focus,
    parents: parentIds.map(get),
    partnerships,
    child_spouses: childSpouses,
    spouse_wed_dates: Object.fromEntries(focusSpouses.map((s) => [s.id, marriageLabel(s)])),
    child_spouse_wed_dates: childSpouseWed,
    parents_wed_date: marriageLabel(parentsMarriage),
  };
}

// Default focus: first person with no recorded parents, else the first entry.
export const defaultFocusId = (people) =>
  (people.find((p) => !(p.parents || []).length) || people[0])?.id;
