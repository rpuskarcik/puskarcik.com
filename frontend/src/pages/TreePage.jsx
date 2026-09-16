import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import FamilyTree from "@/components/FamilyTree";
import PersonDetailModal from "@/components/PersonDetailModal";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Home } from "lucide-react";
import { toast } from "sonner";

export default function TreePage() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tree, setTree] = useState(null);
  const [history, setHistory] = useState([]); // stack of previous focus ids
  const [modalPerson, setModalPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  const loadTree = useCallback(
    async (id) => {
      setLoading(true);
      try {
        let targetId = id;
        if (!targetId) {
          const { data } = await api.get("/tree/root/default");
          targetId = data.person_id;
        }
        const { data } = await api.get(`/tree/${targetId}`);
        setTree(data);
      } catch (e) {
        toast.error("Could not load tree");
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadTree(personId);
  }, [personId, loadTree]);

  const handleSelect = (newId) => {
    if (!tree?.focus) return;
    setHistory((h) => [...h, tree.focus.id]);
    navigate(`/tree/${newId}`);
  };

  const handleFocusClick = async (person) => {
    // Fetch full details if authed (otherwise gets basic)
    try {
      const { data } = await api.get(`/people/${person.id}`);
      setModalPerson(data);
    } catch {
      setModalPerson(person);
    }
  };

  const handleModalBack = () => {
    setModalPerson(null);
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      navigate(`/tree/${prev}`);
      return h.slice(0, -1);
    });
  };

  const goHome = () => {
    setHistory([]);
    navigate("/");
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    navigate(`/tree/${prev}`);
  };

  return (
    <div className="parchment min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-10 pb-24">
        {/* Hero */}
        <section className="text-center mb-10 space-y-3">
          <div className="text-[11px] tracking-[0.22em] uppercase text-[#9e472a] font-medium">
            A Living Record
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#1c2024] tracking-tight">
            The Puskarcik Family Tree
          </h1>
          <p className="max-w-xl mx-auto text-[15px] text-[#4a5157] leading-relaxed">
            Click any name to explore that branch. {user ? "As a contributor, hover a name to see dates, and click the highlighted person to open their full record." : "Sign in to reveal dates and detailed biographies."}
          </p>
        </section>

        {/* Nav row */}
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goHome}
              className="border-[#e2dacd]"
              data-testid="tree-home-btn"
            >
              <Home className="w-4 h-4 mr-1.5" /> Root
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              disabled={history.length === 0}
              className="border-[#e2dacd] disabled:opacity-40"
              data-testid="tree-back-btn"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
          {tree?.focus && (
            <div className="text-xs font-mono text-[#687076] tracking-tight">
              Viewing: <span className="text-[#1c2024]">{tree.focus.name}</span>
            </div>
          )}
        </div>

        {/* Tree canvas */}
        <div
          ref={canvasRef}
          className="rounded-2xl bg-[#fffdf8] border border-[#e2dacd] shadow-sm"
          data-testid="tree-canvas"
        >
          {loading && (
            <div className="py-24 text-center text-[#687076] font-mono text-sm">
              Loading tree…
            </div>
          )}
          {!loading && tree && (
            <FamilyTree
              tree={tree}
              showDates={!!user}
              onSelect={handleSelect}
              onFocusClick={handleFocusClick}
              onLayout={() => {
                const container = canvasRef.current;
                if (!container) return;
                const focusEl = container.querySelector(
                  `[data-testid="focus-node-${tree.focus?.id}"]`
                );
                if (!focusEl) return;
                const cRect = container.getBoundingClientRect();
                const fRect = focusEl.getBoundingClientRect();
                const target =
                  container.scrollLeft + (fRect.left - cRect.left) - cRect.width / 2 + fRect.width / 2;
                container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
              }}
            />
          )}
          {!loading && !tree && (
            <div className="py-24 text-center text-[#687076] text-sm">No data yet.</div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-[#687076] font-mono">
          <div className="flex items-center gap-2"><span className="gender-badge gender-M">♂</span>Male</div>
          <div className="flex items-center gap-2"><span className="gender-badge gender-F">♀</span>Female</div>
          <div className="flex items-center gap-2">
            <svg width="30" height="6"><path d="M0,3 L30,3" className="tree-line" /></svg>
            Parent line
          </div>
          <div className="flex items-center gap-2">
            <svg width="30" height="6"><path d="M0,3 L30,3" className="tree-line spouse" /></svg>
            Marriage
          </div>
        </div>
      </div>

      <PersonDetailModal
        open={!!modalPerson}
        person={modalPerson}
        onClose={() => setModalPerson(null)}
        onBack={handleModalBack}
        canGoBack={history.length > 0}
      />
    </div>
  );
}
