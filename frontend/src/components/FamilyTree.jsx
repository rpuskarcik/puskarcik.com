import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import PersonNode from "./PersonNode";

/**
 * Vertical layout:
 *
 *   Parents row:    [ Father ] ---dashed--- [ Mother ]
 *                                  |
 *   Focus row:      [ FOCUS ] ---dashed--- [ Spouse 1 ]
 *                     |
 *                     +--- [ Spouse 2 ]    (each extra spouse on its own row)
 *                     |                     joined by a dashed line dropping
 *                     +--- [ Spouse 3 ]     from the person's center-bottom.
 *                                  |     (children spine)
 *                                  +------[ Child 1 ] ---dashed--- [ Spouse 1 ]
 *                                  |         |
 *                                  |         +--- [ Spouse 2 ]
 *                                  |
 *                                  +------[ Child 2 ] ---dashed--- [ Spouse 1 ]
 *
 * All spouses beyond the first stack vertically under their partner.
 */
export default function FamilyTree({ tree, showDates, onSelect, onFocusClick, onLayout }) {
  const containerRef = useRef(null);
  const parentsRefs = useRef({});
  const focusRef = useRef(null);
  const focusBlockRef = useRef(null); // wraps focus row + extra spouse rows
  const spouseRefs = useRef({}); // all focus spouses, keyed by spouse id
  const childRefs = useRef({});
  const childSpouseRefs = useRef({}); // key: `${childId}:${spouseId}`
  const [lines, setLines] = useState([]);

  const computeLines = () => {
    if (!containerRef.current) return;

    // Purge stale DOM references
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

    // ---------- Focus <-> first spouse (inline, horizontal dashed) ----------
    const focusSpouses = tree.spouses || [];
    if (focusSpouses.length > 0) {
      const firstSpouseId = focusSpouses[0].id;
      const sr = rect(spouseRefs.current[firstSpouseId]);
      if (sr) {
        const y = focusRect.cy;
        const leftInner = Math.min(focusRect.x + focusRect.w, sr.x + sr.w);
        const rightInner = Math.max(focusRect.x, sr.x);
        newLines.push({ d: `M${leftInner},${y} L${rightInner},${y}`, kind: "spouse" });
      }
    }

    // ---------- Focus extras: trunk down from focus + 90° branch to each ----------
    const focusExtras = focusSpouses.slice(1)
      .map((sp) => rect(spouseRefs.current[sp.id]))
      .filter(Boolean);
    if (focusExtras.length > 0) {
      const trunkX = focusRect.cx;
      const lastY = Math.max(...focusExtras.map((r) => r.cy));
      newLines.push({ d: `M${trunkX},${focusRect.bottom} L${trunkX},${lastY}`, kind: "spouse" });
      focusExtras.forEach((r) => {
        newLines.push({ d: `M${trunkX},${r.cy} L${r.x},${r.cy}`, kind: "spouse" });
      });
    }

    // ---------- Children spine (from bottom of focus block) ----------
    const focusBlockRect = rect(focusBlockRef.current) || focusRect;
    const childEntries = Object.entries(childRefs.current)
      .map(([id, el]) => ({ id, r: rect(el) }))
      .filter((c) => c.r);

    if (childEntries.length > 0) {
      const spineX = focusRect.cx;
      const spineTop = focusBlockRect.bottom;
      const spineBottom = Math.max(...childEntries.map((c) => c.r.cy));
      newLines.push({ d: `M${spineX},${spineTop} L${spineX},${spineBottom}`, kind: "parent" });
      childEntries.forEach((c) => {
        newLines.push({ d: `M${spineX},${c.r.cy} L${c.r.x},${c.r.cy}`, kind: "parent" });
      });
    }

    // ---------- Per-child: first spouse inline + extras stacked ----------
    (tree.children || []).forEach((c) => {
      const cr = rect(childRefs.current[c.id]);
      if (!cr) return;
      const sps = (tree.child_spouses || {})[c.id] || [];
      // Inline (first) spouse: horizontal dashed
      if (sps.length > 0) {
        const firstSr = rect(childSpouseRefs.current[`${c.id}:${sps[0].id}`]);
        if (firstSr) {
          const y = cr.cy;
          const leftInner = Math.min(cr.x + cr.w, firstSr.x + firstSr.w);
          const rightInner = Math.max(cr.x, firstSr.x);
          newLines.push({ d: `M${leftInner},${y} L${rightInner},${y}`, kind: "spouse" });
        }
      }
      // Extras: trunk from child bottom + 90° branch to each
      const extras = sps.slice(1)
        .map((sp) => rect(childSpouseRefs.current[`${c.id}:${sp.id}`]))
        .filter(Boolean);
      if (extras.length > 0) {
        const trunkX = cr.cx;
        const lastY = Math.max(...extras.map((r) => r.cy));
        newLines.push({ d: `M${trunkX},${cr.bottom} L${trunkX},${lastY}`, kind: "spouse" });
        extras.forEach((r) => {
          newLines.push({ d: `M${trunkX},${r.cy} L${r.x},${r.cy}`, kind: "spouse" });
        });
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

  const firstSpouse = spouses[0];
  const extraSpouses = spouses.slice(1);

  const CHILD_INDENT = 40;
  const EXTRA_SPOUSE_INDENT = 40; // indent for extras relative to their partner

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

      {/* Focus block: focus row + any extra spouse rows */}
      <div ref={focusBlockRef} className="relative z-10 mb-12">
        <div className="flex justify-center items-center gap-14 flex-nowrap">
          <div ref={focusRef}>
            <PersonNode
              person={tree.focus}
              focused
              showDates={showDates}
              onClick={() => onFocusClick(tree.focus)}
              testId={`focus-node-${tree.focus.id}`}
            />
          </div>
          {firstSpouse && (
            <div ref={(el) => (spouseRefs.current[firstSpouse.id] = el)}>
              <PersonNode
                person={firstSpouse}
                showDates={showDates}
                onClick={() => onSelect(firstSpouse.id)}
                testId={`spouse-node-${firstSpouse.id}`}
              />
            </div>
          )}
        </div>
        {extraSpouses.length > 0 && (
          <div className="flex flex-col gap-3 mt-3">
            {extraSpouses.map((sp) => (
              <div
                key={sp.id}
                className="flex"
                style={{ paddingLeft: `calc(50% + ${EXTRA_SPOUSE_INDENT}px)` }}
              >
                <div ref={(el) => (spouseRefs.current[sp.id] = el)}>
                  <PersonNode
                    person={sp}
                    showDates={showDates}
                    onClick={() => onSelect(sp.id)}
                    testId={`spouse-node-${sp.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Children column: each child block = child row + its extras */}
      {children.length > 0 && (
        <div
          className="relative z-10 flex flex-col gap-4"
          style={{ paddingLeft: `calc(50% - 80px + ${CHILD_INDENT}px)` }}
        >
          {children.map((c) => {
            const sps = childSpouses[c.id] || [];
            const firstSp = sps[0];
            const extras = sps.slice(1);
            return (
              <div key={c.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-4 flex-nowrap">
                  <div ref={(el) => (childRefs.current[c.id] = el)}>
                    <PersonNode
                      person={c}
                      showDates={showDates}
                      onClick={() => onSelect(c.id)}
                      testId={`child-node-${c.id}`}
                    />
                  </div>
                  {firstSp && (
                    <div
                      ref={(el) => (childSpouseRefs.current[`${c.id}:${firstSp.id}`] = el)}
                    >
                      <PersonNode
                        person={firstSp}
                        showDates={showDates}
                        onClick={() => onSelect(firstSp.id)}
                        testId={`child-spouse-node-${firstSp.id}`}
                      />
                    </div>
                  )}
                </div>
                {extras.length > 0 && (
                  <div
                    className="flex flex-col gap-2"
                    style={{ paddingLeft: `${EXTRA_SPOUSE_INDENT}px` }}
                  >
                    {extras.map((sp) => (
                      <div
                        key={sp.id}
                        ref={(el) =>
                          (childSpouseRefs.current[`${c.id}:${sp.id}`] = el)
                        }
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
