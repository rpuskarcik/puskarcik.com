import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import PersonNode from "./PersonNode";

/**
 * Vertical layout:
 *
 *   Parents row:    [ Father ] ---dashed--- [ Mother ]
 *                                  |
 *   Focus row:      [ FOCUS ] ---dashed--- [ Spouse ]
 *                                  |     (vertical spine)
 *                                  +------[ Child 1 ] ---dashed--- [ Spouse ]
 *                                  |
 *                                  +------[ Child 2 ] ---dashed--- [ Spouse ]
 *                                  ...
 *
 * All couples stay on a single horizontal row; children stack vertically.
 */
export default function FamilyTree({ tree, showDates, onSelect, onFocusClick, onLayout }) {
  const containerRef = useRef(null);
  const parentsRefs = useRef({});
  const focusRef = useRef(null);
  const spouseRefs = useRef({});
  const childRefs = useRef({});
  const childSpouseRefs = useRef({});
  const [lines, setLines] = useState([]);

  const computeLines = () => {
    if (!containerRef.current) return;

    // Purge stale DOM references (nodes removed from the tree between renders)
    [parentsRefs, childRefs, spouseRefs, childSpouseRefs].forEach((mapRef) => {
      Object.keys(mapRef.current).forEach((k) => {
        if (!mapRef.current[k]?.isConnected) delete mapRef.current[k];
      });
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
        cy: r.top - container.top + r.height / 2,
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

    // ---------- Parents row (horizontal couple) ----------
    const parentEntries = Object.entries(parentsRefs.current)
      .map(([id, el]) => ({ id, r: rect(el) }))
      .filter((e) => e.r);
    if (parentEntries.length >= 2) {
      const [a, b] = parentEntries;
      const y = a.r.cy;
      const leftInner = Math.min(a.r.x + a.r.w, b.r.x + b.r.w);
      const rightInner = Math.max(a.r.x, b.r.x);
      newLines.push({ d: `M${leftInner},${y} L${rightInner},${y}`, kind: "spouse" });
      const midX = (a.r.cx + b.r.cx) / 2;
      const busY = Math.max(a.r.bottom, b.r.bottom) + 18;
      newLines.push({ d: `M${midX},${y} L${midX},${busY}`, kind: "parent" });
      newLines.push({ d: `M${midX},${busY} L${focusRect.cx},${busY}`, kind: "parent" });
      newLines.push({ d: `M${focusRect.cx},${busY} L${focusRect.cx},${focusRect.top}`, kind: "parent" });
    } else if (parentEntries.length === 1) {
      const p = parentEntries[0];
      const midY = p.r.bottom + 18;
      newLines.push({ d: `M${p.r.cx},${p.r.bottom} L${p.r.cx},${midY}`, kind: "parent" });
      newLines.push({ d: `M${p.r.cx},${midY} L${focusRect.cx},${midY}`, kind: "parent" });
      newLines.push({ d: `M${focusRect.cx},${midY} L${focusRect.cx},${focusRect.top}`, kind: "parent" });
    }

    // ---------- Focus <-> spouse(s) (dashed) ----------
    // For multiple spouses, sort focus + spouses left→right and draw a dashed
    // line between each adjacent pair (edge-to-edge) so lines don't overlap.
    const focusRowRefs = [
      { ref: focusRef.current, isFocus: true },
      ...Object.values(spouseRefs.current).map((el) => ({ ref: el, isFocus: false })),
    ];
    const focusRow = focusRowRefs
      .map(({ ref }) => rect(ref))
      .filter(Boolean)
      .sort((a, b) => a.cx - b.cx);
    for (let i = 0; i < focusRow.length - 1; i++) {
      const left = focusRow[i];
      const right = focusRow[i + 1];
      const y = (left.cy + right.cy) / 2;
      newLines.push({ d: `M${left.x + left.w},${y} L${right.x},${y}`, kind: "spouse" });
    }

    // ---------- Children (vertical spine) ----------
    const childEntries = Object.entries(childRefs.current)
      .map(([id, el]) => ({ id, r: rect(el) }))
      .filter((c) => c.r);

    if (childEntries.length > 0) {
      // Spine origin: below the focus person
      const spineX = focusRect.cx;
      const spineTop = focusRect.bottom;
      const spineBottom = Math.max(...childEntries.map((c) => c.r.cy));
      // Vertical spine
      newLines.push({ d: `M${spineX},${spineTop} L${spineX},${spineBottom}`, kind: "parent" });
      // Horizontal branch to each child (child sits to the right of spine)
      childEntries.forEach((c) => {
        newLines.push({ d: `M${spineX},${c.r.cy} L${c.r.x},${c.r.cy}`, kind: "parent" });
      });
    }

    // ---------- Child <-> child-spouse(s) (dashed) ----------
    // Group spouse refs by child id, then draw adjacent-pair dashed lines
    // for [child, spouse1, spouse2, ...] sorted left→right.
    const childSpouseByChild = {};
    Object.entries(childSpouseRefs.current).forEach(([key, el]) => {
      const [childId] = key.split(":");
      (childSpouseByChild[childId] ||= []).push(el);
    });
    Object.entries(childSpouseByChild).forEach(([childId, els]) => {
      const childEl = childRefs.current[childId];
      const rowRects = [childEl, ...els]
        .map(rect)
        .filter(Boolean)
        .sort((a, b) => a.cx - b.cx);
      for (let i = 0; i < rowRects.length - 1; i++) {
        const left = rowRects[i];
        const right = rowRects[i + 1];
        const y = (left.cy + right.cy) / 2;
        newLines.push({ d: `M${left.x + left.w},${y} L${right.x},${y}`, kind: "spouse" });
      }
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

  // The children column is inset slightly to the right of the spine.
  const CHILD_INDENT = 40;

  return (
    <div ref={containerRef} className="relative py-10 px-6" data-testid="family-tree">
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

      {/* Focus + spouse row */}
      <div className="relative z-10 flex justify-center items-center gap-14 mb-12 flex-wrap">
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

      {/* Children column (vertical stack, indented from center) */}
      {children.length > 0 && (
        <div
          className="relative z-10 flex flex-col gap-4"
          style={{ paddingLeft: `calc(50% - 80px + ${CHILD_INDENT}px)` }}
        >
          {children.map((c) => {
            const sps = childSpouses[c.id] || [];
            return (
              <div key={c.id} className="flex items-center gap-4 flex-nowrap">
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
