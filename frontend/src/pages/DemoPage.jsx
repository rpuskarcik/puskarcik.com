import React, { useEffect, useRef } from "react";
import { renderFamilyTree, sampleFamily } from "@/familyTree";

// Standalone usage: no API, no database — just the sample array.
export default function DemoPage() {
  const ref = useRef(null);

  useEffect(() => {
    const tree = renderFamilyTree(ref.current, sampleFamily, { showDates: true });
    return () => tree.destroy();
  }, []);

  return (
    <div className="parchment min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-10 pb-24">
        <h1 className="font-serif-display text-4xl font-semibold text-[#1c2024] mb-2">renderFamilyTree() demo</h1>
        <p className="text-sm text-[#4a5157] mb-6">Rendered from the static sample array in <code>src/familyTree/sampleData.js</code>.</p>
        <div
          ref={ref}
          className="rounded-2xl bg-[#fffdf8] border border-[#e2dacd] shadow-sm overflow-x-auto"
          data-testid="demo-tree-canvas"
        />
      </div>
    </div>
  );
}
