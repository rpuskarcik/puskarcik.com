import React, { useState } from "react";

export default function PersonNode({
  person,
  focused = false,
  showDates = false,
  onClick,
  testId,
}) {
  const [hover, setHover] = useState(false);
  if (!person) return null;
  const genderClass =
    person.gender === "M" ? "gender-M" : person.gender === "F" ? "gender-F" : "gender-O";
  const symbol = person.gender === "M" ? "♂" : person.gender === "F" ? "♀" : "•";

  return (
    <div
      className={`node-card ${focused ? "focus" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-testid={testId || `person-node-${person.id}`}
    >
      <div className="flex items-center gap-2">
        <span className={`gender-badge ${genderClass}`} aria-label={person.gender}>
          {symbol}
        </span>
        <div className="flex-1 min-w-0">
          {/* New Person */}
          <div className="font-serif-display text-[14px] leading-tight font-semibold text-[#1c2024] break-words">
            {person.name}
          </div>
          {showDates && (person.birth_date || person.death_date) ? (
            <div className="font-mono text-[10px] text-[#687076] mt-0.5 tracking-tight">
              {person.birth_date || "?"} — {person.death_date || "living"}
            </div>
          ) : null}
        </div>
      </div>

      {hover && showDates && (person.birth_date || person.death_date) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-[#1c2024] text-[#fbf9f5] text-[11px] px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap z-30 font-mono"
          data-testid={`person-tooltip-${person.id}`}
        >
          {(person.birth_date || "?")} — {(person.death_date || "living")}
        </div>
      )}
    </div>
  );
}
