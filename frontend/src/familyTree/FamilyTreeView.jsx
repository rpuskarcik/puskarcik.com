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
  const trunkColRef = useRef(null); // ref to trunk column for offset calculations
  const spouseRefs = useRef({}); // all focus spouses (inline first + trunk rows)
  const childRefs = useRef({});
  const childSpouseRefs = useRef({}); // key: `${childId}:${spouseId}`
  const [lines, setLines] = useState([]);
  const [hoveredWedDate, setHoveredWedDate] = useState(null); // {x, y, text}
  const [extraPartnerX, setExtraPartnerX] = useState(null); // px, aligns extras with first partner

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
    // Helper: attach a wed_date to the most-recently-pushed line, along with
    // the midpoint used for the hover tooltip anchor.
    const attachWed = (midX, midY, text) => {
      if (!text || newLines.length === 0) return;
      const last = newLines[newLines.length - 1];
      last.wedDate = text;
      last.midX = midX;
      last.midY = midY;
    };
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
      // Center-to-center: portions inside opaque node cards are hidden, so
      // the visible dashed segment always terminates cleanly at each box edge.
      newLines.push({ d: `M${a.r.cx},${y} L${b.r.cx},${y}`, kind: "spouse" });
      // Wedding date hover anchor: midpoint between the two parents on that line
      attachWed((a.r.cx + b.r.cx) / 2, y, tree.parents_wed_date);
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
      const fpEl = spouseRefs.current[firstPartner.id];
      const sr = rect(fpEl);
      if (sr) {
        const y = focusRect.cy;
        newLines.push({ d: `M${focusRect.cx},${y} L${sr.cx},${y}`, kind: "spouse" });
        attachWed((focusRect.cx + sr.cx) / 2, y, (tree.spouse_wed_dates || {})[firstPartner.id]);
        // Align subsequent partner rows under the first partner's DOM x
        if (fpEl && trunkColRef.current) {
          const fpDom = fpEl.getBoundingClientRect();
          const trunkDom = trunkColRef.current.getBoundingClientRect();
          const newX = fpDom.left - trunkDom.left;
          if (extraPartnerX == null || Math.abs(extraPartnerX - newX) > 0.5) {
            setExtraPartnerX(newX);
          }
        }
      }
    }

    // ---------- Trunk column (single solid vertical + branches) ----------
    // Build the ordered list of trunk rows in the exact order they were rendered.
    const trunkRows = [];
    partnerships.forEach((p, pIdx) => {
      if (pIdx > 0 && p.partner) {
        const r = rect(spouseRefs.current[p.partner.id]);
        if (r) trunkRows.push({ kind: "partner", r, wedDate: (tree.spouse_wed_dates || {})[p.partner.id] });
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
        // Dashed spouse branches extend to the box CENTER (portion inside the
        // box is hidden by the opaque node) so the visible endpoint always
        // meets the box edge cleanly. Solid child branches end at the left edge.
        if (row.kind === "partner") {
          newLines.push({
            d: `M${trunkX},${row.r.cy} L${row.r.cx},${row.r.cy}`,
            kind: "spouse",
          });
          attachWed((trunkX + row.r.cx) / 2, row.r.cy, row.wedDate);
        } else {
          newLines.push({
            d: `M${trunkX},${row.r.cy} L${row.r.x},${row.r.cy}`,
            kind: "parent",
          });
        }
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
            // center-to-center dashed marriage line
            newLines.push({ d: `M${cr.cx},${y} L${firstSr.cx},${y}`, kind: "spouse" });
            attachWed((cr.cx + firstSr.cx) / 2, y, (tree.child_spouse_wed_dates || {})[`${c.id}:${sps[0].id}`]);
          }
        }
        const extras = sps.slice(1)
          .map((sp) => ({ sp, r: rect(childSpouseRefs.current[`${c.id}:${sp.id}`]) }))
          .filter((x) => x.r);
        if (extras.length > 0) {
          const trunkX = cr.cx;
          const lastY = Math.max(...extras.map((x) => x.r.cy));
          newLines.push({ d: `M${trunkX},${cr.bottom} L${trunkX},${lastY}`, kind: "spouse" });
          extras.forEach(({ sp, r }) => {
            newLines.push({ d: `M${trunkX},${r.cy} L${r.cx},${r.cy}`, kind: "spouse" });
            attachWed((trunkX + r.cx) / 2, r.cy, (tree.child_spouse_wed_dates || {})[`${c.id}:${sp.id}`]);
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
          <path
            key={`v-${i}`}
            d={l.d}
            className={`tree-line ${l.kind === "spouse" ? "spouse" : ""}`}
          />
        ))}
      </svg>
      {/* Hit paths in a top-layer SVG so they receive hover above node columns */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 20, pointerEvents: "none" }}
      >
        {lines.map((l, i) =>
          l.wedDate ? (
            <path
              key={`h-${i}`}
              d={l.d}
              stroke="rgba(0,0,0,0)"
              strokeWidth={18}
              fill="none"
              style={{ pointerEvents: "stroke", cursor: "help" }}
              onMouseOver={() =>
                setHoveredWedDate({ x: l.midX, y: l.midY, text: l.wedDate })
              }
              onMouseOut={() => setHoveredWedDate(null)}
            />
          ) : null
        )}
      </svg>
      {hoveredWedDate && (
        <div
          className="absolute font-mono text-[11px] tracking-tight text-[#fbf9f5] bg-[#1c2024] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: hoveredWedDate.x,
            top: hoveredWedDate.y - 14,
            transform: "translate(-50%, -100%)",
            zIndex: 30,
          }}
          data-testid="wed-date-tooltip"
        >
          m. {hoveredWedDate.text}
        </div>
      )}

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
      <div ref={trunkColRef} className="relative z-10 flex flex-col gap-4">
        {partnerships.map((p, pIdx) => (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && p.partner && (
              <div
                style={{
                  paddingLeft:
                    extraPartnerX != null
                      ? `${extraPartnerX}px`
                      : `calc(50% - 80px + ${TRUNK_INDENT}px)`,
                }}
              >
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
              </div>
            )}
            {p.children.map((c) => {
              const sps = childSpouses[c.id] || [];
              const firstSp = sps[0];
              const extras = sps.slice(1);
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-2"
                  style={{ paddingLeft: `calc(50% - 80px + ${TRUNK_INDENT}px)` }}
                >
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
