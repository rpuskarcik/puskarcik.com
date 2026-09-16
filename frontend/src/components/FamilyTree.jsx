import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import PersonNode from "./PersonNode";

/**
 * Layout:
 *   Parents row:    [ Father ] ---dashed--- [ Mother ]
 *                                  |
 *                                  | (parent line drops to each blood child)
 *   Focus row:      [ FOCUS ] ---dashed--- [ Spouse(s) ]
 *                                  |
 *   Children row:   [ Child ] ---dashed--- [ Spouse ]   [ Child ] ---dashed--- [ Spouse ]
 *
 * Parent lines only connect blood relatives (parents -> child, focus -> child).
 * Spouses are joined by a horizontal dashed marriage line on the same row.
 */
export default function FamilyTree({ tree, showDates, onSelect, onFocusClick, onLayout }) {
  const containerRef = useRef(null);
  const parentsRefs = useRef({});
  const focusRef = useRef(null);
  const spouseRefs = useRef({});
  const childRefs = useRef({});
  const childSpouseRefs = useRef({}); // key: `${childId}:${spouseId}`
  const [lines, setLines] = useState([]);

  const computeLines = () => {
    if (!containerRef.current) return;
    // Reset stale refs first (React may keep null-callback entries)
    Object.keys(parentsRefs.current).forEach((k) => {
      if (!parentsRefs.current[k]?.isConnected) delete parentsRefs.current[k];
    });
    Object.keys(childRefs.current).forEach((k) => {
      if (!childRefs.current[k]?.isConnected) delete childRefs.current[k];
    });
    Object.keys(spouseRefs.current).forEach((k) => {
      if (!spouseRefs.current[k]?.isConnected) delete spouseRefs.current[k];
    });
    Object.keys(childSpouseRefs.current).forEach((k) => {
      if (!childSpouseRefs.current[k]?.isConnected) delete childSpouseRefs.current[k];
    });

    const container = containerRef.current.getBoundingClientRect();
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left - container.left,
        y: r.top - container.top,
        w: r.width,
        h: r.height,
        cx: r.left - container.left + r.width / 2,
        top: r.top - container.top,
        bottom: r.top - container.top + r.height,
      };
    };
    const newLines = [];
    const focusRect = rect(focusRef.current);
    if (!focusRect) {
      setLines([]);
      return;
    }

    // Parents: dashed marriage between them + solid drop to focus
    const parentEntries = Object.entries(parentsRefs.current)
      .map(([id, el]) => ({ id, r: rect(el) }))
      .filter((e) => e.r);
    if (parentEntries.length >= 2) {
      const [a, b] = parentEntries;
      const y = a.r.top + a.r.h / 2;
      const leftInner = Math.min(a.r.x + a.r.w, b.r.x + b.r.w);
      const rightInner = Math.max(a.r.x, b.r.x);
      newLines.push({
        d: `M${leftInner},${y} L${rightInner},${y}`,
        kind: "spouse",
      });
      const midX = (a.r.cx + b.r.cx) / 2;
      const busY = Math.max(a.r.bottom, b.r.bottom) + 18;
      newLines.push({ d: `M${midX},${y} L${midX},${busY}`, kind: "parent" });
      newLines.push({ d: `M${midX},${busY} L${focusRect.cx},${busY}`, kind: "parent" });
      newLines.push({ d: `M${focusRect.cx},${busY} L${focusRect.cx},${focusRect.top}`, kind: "parent" });
    } else if (parentEntries.length === 1) {
      const p = parentEntries[0];
      newLines.push({ d: `M${p.r.cx},${p.r.bottom} L${p.r.cx},${p.r.bottom + 18}`, kind: "parent" });
      newLines.push({ d: `M${p.r.cx},${p.r.bottom + 18} L${focusRect.cx},${p.r.bottom + 18}`, kind: "parent" });
      newLines.push({ d: `M${focusRect.cx},${p.r.bottom + 18} L${focusRect.cx},${focusRect.top}`, kind: "parent" });
    }

    // Focus <-> spouse (dashed marriage line, same row)
    Object.values(spouseRefs.current)
      .map(rect)
      .filter(Boolean)
      .forEach((sr) => {
        const y = focusRect.top + focusRect.h / 2;
        const leftInner = Math.min(focusRect.x + focusRect.w, sr.x + sr.w);
        const rightInner = Math.max(focusRect.x, sr.x);
        newLines.push({
          d: `M${leftInner},${y} L${rightInner},${y}`,
          kind: "spouse",
        });
      });

    // Children row: parent line from focus down to each blood child
    const childEntries = Object.entries(childRefs.current)
      .map(([id, el]) => ({ id, r: rect(el) }))
      .filter((c) => c.r);
    if (childEntries.length > 0) {
      const busY = focusRect.bottom + 30;
      newLines.push({ d: `M${focusRect.cx},${focusRect.bottom} L${focusRect.cx},${busY}`, kind: "parent" });
      const xs = childEntries.map((c) => c.r.cx);
      const minX = Math.min(...xs, focusRect.cx);
      const maxX = Math.max(...xs, focusRect.cx);
      newLines.push({ d: `M${minX},${busY} L${maxX},${busY}`, kind: "parent" });
      childEntries.forEach((c) => {
        newLines.push({ d: `M${c.r.cx},${busY} L${c.r.cx},${c.r.top}`, kind: "parent" });
      });
    }

    // Child <-> child-spouse dashed marriage line (same row as child)
    Object.entries(childSpouseRefs.current).forEach(([key, el]) => {
      const [childId] = key.split(":");
      const childEl = childRefs.current[childId];
      const cr = rect(childEl);
      const sr = rect(el);
      if (!cr || !sr) return;
      const y = cr.top + cr.h / 2;
      const leftInner = Math.min(cr.x + cr.w, sr.x + sr.w);
      const rightInner = Math.max(cr.x, sr.x);
      newLines.push({ d: `M${leftInner},${y} L${rightInner},${y}`, kind: "spouse" });
    });

    setLines(newLines);
    if (typeof onLayout === "function") onLayout();
  };

  useLayoutEffect(() => {
    computeLines();
  }, [tree]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => computeLines();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tree || !tree.focus) return null;

  const parents = tree.parents || [];
  const spouses = tree.spouses || [];
  const children = tree.children || [];
  const childSpouses = tree.child_spouses || {};

  return (
    <div ref={containerRef} className="relative py-8 px-4 min-w-max" data-testid="family-tree">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {lines.map((l, i) => (
          <path key={i} d={l.d} className={`tree-line ${l.kind === "spouse" ? "spouse" : ""}`} />
        ))}
      </svg>

      {/* Parents row: side-by-side like a couple */}
      {parents.length > 0 && (
        <div className="relative z-10 flex justify-center items-center gap-14 mb-16 flex-wrap">
          {parents.map((p) => (
            <div key={p.id} ref={(el) => (parentsRefs.current[p.id] = el)}>
              <PersonNode
                person={p}
                showDates={showDates}
                onClick={() => onSelect(p.id)}
                testId={`parent-node-${p.id}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Focus + spouse row: side-by-side couple */}
      <div className="relative z-10 flex justify-center items-center gap-14 mb-16 flex-wrap">
        <div ref={focusRef}>
          <PersonNode
            person={tree.focus}
            focused
            showDates={showDates}
            onClick={() => onFocusClick(tree.focus)}
            testId={`focus-node-${tree.focus.id}`}
          />
        </div>
        {spouses.map((s) => (
          <div key={s.id} ref={(el) => (spouseRefs.current[s.id] = el)}>
            <PersonNode
              person={s}
              showDates={showDates}
              onClick={() => onSelect(s.id)}
              testId={`spouse-node-${s.id}`}
            />
          </div>
        ))}
      </div>

      {/* Children row: each blood child on same row as its spouse(s) */}
      {children.length > 0 && (
        <div className="relative z-10 flex justify-center gap-10 flex-wrap items-start">
          {children.map((c) => {
            const sps = childSpouses[c.id] || [];
            return (
              <div key={c.id} className="flex items-center gap-8">
                <div ref={(el) => (childRefs.current[c.id] = el)}>
                  <PersonNode
                    person={c}
                    showDates={showDates}
                    onClick={() => onSelect(c.id)}
                    testId={`child-node-${c.id}`}
                  />
                </div>
                {sps.map((sp) => (
                  <div
                    key={sp.id}
                    ref={(el) => (childSpouseRefs.current[`${c.id}:${sp.id}`] = el)}
                  >
                    <PersonNode
                      person={sp}
                      showDates={showDates}
                      onClick={() => onSelect(sp.id)}
                      testId={`child-spouse-node-${sp.id}`}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
