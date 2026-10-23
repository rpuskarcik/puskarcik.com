import React from "react";
import { createRoot } from "react-dom/client";
import FamilyTreeView from "./FamilyTreeView";
import DetailWindow from "./DetailWindow";
import { buildTree, defaultFocusId } from "./buildTree";
import "./familyTree.css";

/**
 * Draw a family tree into `container` from a flat `people` array. See README.md.
 * Returns { setFocus(id), update(people?, options?), getFocus(), destroy() }.
 */
export function renderFamilyTree(container, people, options = {}) {
  const mount = document.createElement("div");
  container.appendChild(mount);
  const root = createRoot(mount);
  const state = { people, options, focusId: options.focusId || defaultFocusId(people), detail: null };

  const centerOnFocus = () => {
    const el = container.querySelector(`[data-testid="focus-node-${state.focusId}"]`);
    if (!el) return;
    const c = container.getBoundingClientRect();
    const f = el.getBoundingClientRect();
    const left = container.scrollLeft + (f.left - c.left) - c.width / 2 + f.width / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  };

  const select = (id) => {
    state.focusId = id;
    paint();
    state.options.onSelect?.(id, state.people.find((p) => p.id === id));
  };

  const focusClick = (person) => {
    if (state.options.onFocusClick) return state.options.onFocusClick(person);
    state.detail = person;
    paint();
  };

  const closeDetail = () => {
    state.detail = null;
    paint();
  };

  function paint() {
    const tree = buildTree(state.people, state.focusId);
    root.render(
      <>
        {tree && (
          <FamilyTreeView
            tree={tree}
            showDates={state.options.showDates ?? true}
            onSelect={select}
            onFocusClick={focusClick}
            onLayout={centerOnFocus}
          />
        )}
        {state.detail && <DetailWindow person={state.detail} onClose={closeDetail} />}
      </>
    );
  }

  paint();

  return {
    setFocus(id) {
      if (!id || id === state.focusId) return;
      state.focusId = id;
      paint();
    },
    update(nextPeople, nextOptions) {
      if (nextPeople) state.people = nextPeople;
      if (nextOptions) state.options = { ...state.options, ...nextOptions };
      paint();
    },
    getFocus: () => state.focusId,
    destroy: () =>
      setTimeout(() => {
        root.unmount();
        mount.remove();
      }, 0),
  };
}

export default renderFamilyTree;
