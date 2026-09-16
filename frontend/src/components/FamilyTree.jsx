import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import PersonNode from "./PersonNode";

/**
 * Vertical trunk layout:
 *
 *   Parents:       [ Father ] ---dashed--- [ Mother ]
 *                                 |
 *   Focus row:     [ FOCUS ] ---dashed--- [ 1st Partner (inline) ]
 *                     |
 *                     +--- [ Child of 1st partnership ]
 *                     |
 *                     +---dashed--- [ 2nd Partner ]
 *                     |
 *                     +--- [ Child of 2nd partnership ]
 *                     +--- [ Another Child of 2nd partnership ]
 *
 * A single continuous SOLID vertical trunk drops from the focus person. Each
 * row hanging off it is either a SOLID branch (a child of the focus) or a
 * DASHED branch (an additional spouse / marriage marker). Rows appear in
 * partnership order: partner (if any) → their children, next partner → their
 * children, etc.
 */
export default function FamilyTree({ tree, showDates, onSelect, onFocusClick, onLayout }) {
  const containerRef = useRef(null);
  const parentsRefs = useRef({});
  const focusRef = useRef(null);
  const spouseRefs = useRef({}); // all focus spouses (inline first + trunk rows)
  const childRefs = useRef({});
  const childSpouseRefs = useRef({}); // key: `${childId}:${spouseId}`
  const [lines, setLines] = useState([]);

  const computeLines = () => {
    if (!containerRef.current) return;

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

    // ---------- Parents row ----------
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

    // ---------- Focus <-> first partner (inline dashed) ----------
    const partnerships = tree.partnerships || [];
    const firstPartner = partnerships[0]?.partner;
    if (firstPartner) {
      const sr = rect(spouseRefs.current[firstPartner.id]);
      if (sr) {
        const y = focusRect.cy;
        const leftInner = Math.min(focusRect.x + focusRect.w, sr.x + sr.w);
        const rightInner = Math.max(focusRect.x, sr.x);
        newLines.push({ d: `M${leftInner},${y} L${rightInner},${y}`, kind: "spouse" });
      }
    }

    // ---------- Trunk column (single solid vertical + branches) ----------
    // Build the ordered list of trunk rows in the exact order they were rendered.
    const trunkRows = [];
    partnerships.forEach((p, pIdx) => {
      if (pIdx > 0 && p.partner) {
        const r = rect(spouseRefs.current[p.partner.id]);
        if (r) trunkRows.push({ kind: "partner", r });
      }
      p.children.forEach((c) => {
        const r = rect(childRefs.current[c.id]);
        if (r) trunkRows.push({ kind: "child", r });
      });
    });

    if (trunkRows.length > 0) {
      const trunkX = focusRect.cx;
      const trunkTop = focusRect.bottom;
      const trunkBottom = Math.max(...trunkRows.map((row) => row.r.cy));
      newLines.push({ d: `M${trunkX},${trunkTop} L${trunkX},${trunkBottom}`, kind: "parent" });
      trunkRows.forEach((row) => {
        const branchKind = row.kind === "partner" ? "spouse" : "parent";
        newLines.push({
          d: `M${trunkX},${row.r.cy} L${row.r.x},${row.r.cy}`,
          kind: branchKind,
        });
      });
    }

    // ---------- Per-child: first spouse inline + extras stacked ----------
    partnerships.forEach((p) => {
      p.children.forEach((c) => {
        const cr = rect(childRefs.current[c.id]);
        if (!cr) return;
        const sps = (tree.child_spouses || {})[c.id] || [];
        if (sps.length > 0) {
          const firstSr = rect(childSpouseRefs.current[`${c.id}:${sps[0].id}`]);
          if (firstSr) {
            const y = cr.cy;
            const leftInner = Math.min(cr.x + cr.w, firstSr.x + firstSr.w);
            const rightInner = Math.max(cr.x, firstSr.x);
            newLines.push({ d: `M${leftInner},${y} L${rightInner},${y}`, kind: "spouse" });
          }
        }
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
  const partnerships = tree.partnerships || [{ partner: null, children: [] }];
  const firstPartner = partnerships[0]?.partner || null;
  const childSpouses = tree.child_spouses || {};

  const TRUNK_INDENT = 40;
  const CHILD_EXTRA_SPOUSE_INDENT = 160;

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

      {/* Focus row: focus + first partner (inline) */}
      <div className="relative z-10 flex justify-center items-center gap-14 mb-8 flex-nowrap">
        <div ref={focusRef}>
          <PersonNode
            person={tree.focus}
            focused
            showDates={showDates}
            onClick={() => onFocusClick(tree.focus)}
            testId={`focus-node-${tree.focus.id}`}
          />
        </div>
        {firstPartner && (
          <div ref={(el) => (spouseRefs.current[firstPartner.id] = el)}>
            <PersonNode
              person={firstPartner}
              showDates={showDates}
              onClick={() => onSelect(firstPartner.id)}
              testId={`spouse-node-${firstPartner.id}`}
            />
          </div>
        )}
      </div>

      {/* Trunk column: partnerships in order (extra partner rows + child rows) */}
      <div
        className="relative z-10 flex flex-col gap-4"
        style={{ paddingLeft: `calc(50% - 80px + ${TRUNK_INDENT}px)` }}
      >
        {partnerships.map((p, pIdx) => (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && p.partner && (
              <div
                ref={(el) => (spouseRefs.current[p.partner.id] = el)}
                className="w-fit"
              >
                <PersonNode
                  person={p.partner}
                  showDates={showDates}
                  onClick={() => onSelect(p.partner.id)}
                  testId={`spouse-node-${p.partner.id}`}
                />
              </div>
            )}
            {p.children.map((c) => {
              const sps = childSpouses[c.id] || [];
              const firstSp = sps[0];
              const extras = sps.slice(1);
              return (
                <div key={c.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-4 flex-nowrap w-fit">
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
                        ref={(el) =>
                          (childSpouseRefs.current[`${c.id}:${firstSp.id}`] = el)
                        }
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
                      style={{ paddingLeft: `${CHILD_EXTRA_SPOUSE_INDENT}px` }}
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
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
