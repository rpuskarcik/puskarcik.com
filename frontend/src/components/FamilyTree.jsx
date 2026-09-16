import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import PersonNode from "./PersonNode";

/**
 * Layout:
 *   [ Parents row (parent + parent) ]
 *              |
 *   [ Focus row: focus + spouse(s) ]
 *              |
 *   [ Children row: each child (with spouse under it) ]
 *
 * SVG connectors are drawn between rows.
 */
export default function FamilyTree({ tree, showDates, onSelect, onFocusClick }) {
  const containerRef = useRef(null);
  const parentsRefs = useRef({});
  const focusRef = useRef(null);
  const spouseRefs = useRef({});
  const childRefs = useRef({});
  const [lines, setLines] = useState([]);

  const computeLines = () => {
    if (!containerRef.current) return;
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

    // Parents → focus (vertical from midpoint of parents to top of focus)
    const parentRects = Object.values(parentsRefs.current).map(rect).filter(Boolean);
    if (parentRects.length > 0) {
      const midX =
        parentRects.reduce((s, r) => s + r.cx, 0) / parentRects.length;
      const midY = Math.max(...parentRects.map((r) => r.bottom));
      parentRects.forEach((r) => {
        newLines.push({
          d: `M${r.cx},${r.bottom} L${r.cx},${midY + 18} L${midX},${midY + 18}`,
          kind: "parent",
        });
      });
      newLines.push({
        d: `M${midX},${midY + 18} L${midX},${focusRect.top}`,
        kind: "parent",
      });
    }

    // Focus → spouse (horizontal dashed)
    Object.values(spouseRefs.current)
      .map(rect)
      .filter(Boolean)
      .forEach((sr) => {
        const y = focusRect.top + focusRect.h / 2;
        newLines.push({
          d: `M${Math.min(focusRect.x + focusRect.w, sr.x + sr.w)},${y} L${Math.max(focusRect.x, sr.x)},${y}`,
          kind: "spouse",
        });
      });

    // Focus → children
    const childRects = Object.entries(childRefs.current)
      .map(([id, el]) => ({ id, r: rect(el) }))
      .filter((c) => c.r);
    if (childRects.length > 0) {
      const busY = focusRect.bottom + 24;
      newLines.push({
        d: `M${focusRect.cx},${focusRect.bottom} L${focusRect.cx},${busY}`,
        kind: "child",
      });
      const xs = childRects.map((c) => c.r.cx);
      const minX = Math.min(...xs, focusRect.cx);
      const maxX = Math.max(...xs, focusRect.cx);
      newLines.push({
        d: `M${minX},${busY} L${maxX},${busY}`,
        kind: "child",
      });
      childRects.forEach((c) => {
        newLines.push({
          d: `M${c.r.cx},${busY} L${c.r.cx},${c.r.top}`,
          kind: "child",
        });
      });
    }

    setLines(newLines);
  };

  useLayoutEffect(() => {
    computeLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  useEffect(() => {
    const onResize = () => computeLines();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tree || !tree.focus) return null;

  const parents = tree.parents || [];
  const spouses = tree.spouses || [];
  const children = tree.children || [];
  const childSpouses = tree.child_spouses || {};

  return (
    <div ref={containerRef} className="relative py-8 px-4" data-testid="family-tree">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {lines.map((l, i) => (
          <path key={i} d={l.d} className={`tree-line ${l.kind === "spouse" ? "spouse" : ""}`} />
        ))}
      </svg>

      {/* Parents row */}
      {parents.length > 0 && (
        <div className="relative z-10 flex justify-center gap-10 mb-14 flex-wrap">
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

      {/* Focus + spouse row */}
      <div className="relative z-10 flex justify-center items-center gap-6 mb-14 flex-wrap">
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

      {/* Children row */}
      {children.length > 0 && (
        <div className="relative z-10 flex justify-center gap-6 flex-wrap items-start">
          {children.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-2">
              <div ref={(el) => (childRefs.current[c.id] = el)}>
                <PersonNode
                  person={c}
                  showDates={showDates}
                  onClick={() => onSelect(c.id)}
                  testId={`child-node-${c.id}`}
                />
              </div>
              {(childSpouses[c.id] || []).map((sp) => (
                <div key={sp.id} className="scale-90 opacity-90">
                  <PersonNode
                    person={sp}
                    showDates={showDates}
                    onClick={() => onSelect(sp.id)}
                    testId={`child-spouse-node-${sp.id}`}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
