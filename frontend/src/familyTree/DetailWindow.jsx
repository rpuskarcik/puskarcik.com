import React from "react";

const ROWS = [
  ["Born", "birth_date"],
  ["Birthplace", "birth_place"],
  ["Died", "death_date"],
  ["Place of death", "death_place"],
];

// Built-in detail window, used when no onFocusClick option is supplied.
export default function DetailWindow({ person, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      data-testid="ft-detail-window"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#e2dacd] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-serif-display text-2xl font-semibold text-[#1c2024]" data-testid="ft-detail-name">
            {person.name}
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-[#687076] hover:text-[#9e472a]"
            data-testid="ft-detail-close"
          >
            Close
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {ROWS.filter(([, k]) => person[k]).map(([label, k]) => (
            <React.Fragment key={k}>
              <dt className="text-[#687076]">{label}</dt>
              <dd className="font-mono text-[#1c2024]">{person[k]}</dd>
            </React.Fragment>
          ))}
        </dl>
        {person.bio && <p className="mt-4 text-sm text-[#4a5157] leading-relaxed">{person.bio}</p>}
      </div>
    </div>
  );
}
