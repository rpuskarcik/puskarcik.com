# renderFamilyTree()

One function that draws the whole interactive family tree into a DOM element.
It doesn't depend on any database or API. You pass it the data as an array.

```js
import { renderFamilyTree } from "@/familyTree";

const tree = renderFamilyTree(document.getElementById("tree"), people, {
  focusId: "e9a877db-...",   // optional: who starts at the top
  showDates: true,           // optional (default true)
  onSelect: (id, person) => {},   // optional: a non-focus person was clicked (tree already re-centred)
  onFocusClick: (person) => {},   // optional: top person clicked; if omitted, a built-in detail window opens
});

tree.setFocus(id);              // re-centre on someone
tree.update(newPeople, newOpts);// redraw with new data and/or options
tree.getFocus();                // current focus id
tree.destroy();                 // unmount
```

## Input data: `people` (array)

One object per person. Only `id` and `name` are required.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique |
| `name` | string | Shown on the card |
| `gender` | `"M"` \| `"F"` \| `"O"` | Sets the ♂ / ♀ / • badge (defaults to •) |
| `birth_date`, `death_date` | string | Free text ("c. 1870"). Shown on hover when `showDates` is on |
| `birth_place`, `death_place`, `bio` | string | Shown in the built-in detail window |
| `parents` | string[] | Ids of this person's parents (0–2) |
| `spouses` | `{ id, wed_date?, end_date? }[]` or string[] | Marriages, in order. You only need to list a marriage on **one** of the two people. The wedding date appears when you hover over the dashed line (`"1942 – 1968"` if `end_date` is set) |

Ids that point to people who aren't in the array are ignored. Example: `sampleData.js` (snapshot of the current database, 23 people).

```js
[
  { id: "ludwig", name: "Ludwig Puskarczyk", gender: "M", birth_date: "c. 1870",
    parents: [], spouses: [{ id: "aniela", wed_date: "1893" }] },
  { id: "aniela", name: "Aniela Malek", gender: "F", parents: [], spouses: [] },
  { id: "chester", name: "Chester Puskarcik", gender: "M", parents: ["ludwig", "aniela"] },
]
```

## Dependencies

Runtime packages:
- `react` and `react-dom` (18+, uses `react-dom/client` `createRoot`)
- Tailwind CSS: the components use Tailwind utility classes for layout and spacing
- `familyTree.css`: card, badge and line styles (imported automatically)
- Fonts (optional): the `.font-serif-display` (Fraunces) and `.font-mono` (JetBrains Mono) classes, defined in `src/index.css`

Browser APIs: `getBoundingClientRect`, `window resize` event, `scrollTo`.

Container element: it should be a block element in the page. Give it `overflow-x: auto` so wide trees scroll. The function centres that element horizontally on the focus person.

## Files

| File | Role |
|---|---|
| `renderFamilyTree.jsx` | The single public function: owns focus state and the detail window, and mounts React |
| `buildTree.js` | Pure function `buildTree(people, focusId)`. Turns the flat array into the view model (parents, partnerships → children, children's spouses, marriage labels) |
| `FamilyTreeView.jsx` | Draws the cards, then measures the DOM and draws SVG connector lines and marriage-date hover zones |
| `PersonNode.jsx` | One rounded card (name, gender badge, date tooltip) |
| `DetailWindow.jsx` | Default detail popup for the top person |
| `familyTree.css` | Styles |
| `sampleData.js` | Example input |

## Plain HTML embed (no React needed)

`public/embed/family-tree.js` is a single self-contained file (~200 KB). It includes React and all the styles. It only styles elements inside the tree, and it loads the fonts from Google Fonts.

```html
<div id="tree" style="overflow-x:auto"></div>
<script src="family-tree.js"></script>
<script>
  var tree = FamilyTree.render("#tree", people, { showDates: true });
  // same handle as above: tree.setFocus(id), tree.update(people), tree.destroy()
</script>
```

- Live example: `/embed/example.html`. View the page source for a complete working page.
- To rebuild after changing anything in `src/familyTree/`, run `yarn build:embed` (script: `scripts/build-embed.js`).

## Hooking it to a database

Any backend works. Return the array in the format above. In this app, `GET /api/tree-data` returns `{ root_id, people }` built from MongoDB, and `pages/TreePage.jsx` passes `people` to `renderFamilyTree`.
