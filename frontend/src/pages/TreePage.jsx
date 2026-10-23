import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { renderFamilyTree } from "@/familyTree";
import PersonDetailModal from "@/components/PersonDetailModal";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Home } from "lucide-react";
import { toast } from "sonner";

export default function TreePage() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]); // stack of previous focus ids
  const [modalPerson, setModalPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const treeRef = useRef(null);
  const focusId = personId || data?.root_id || data?.people?.[0]?.id;
  const focusPerson = data?.people?.find((p) => p.id === focusId);
  const focusIdRef = useRef(focusId);
  focusIdRef.current = focusId;

  useEffect(() => {
    setLoading(true);
    api
      .get("/tree-data")
      .then(({ data }) => setData(data))
      .catch((e) => {
        toast.error("Could not load tree");
        console.error(e);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleSelect = (newId) => {
    setHistory((h) => [...h, focusIdRef.current]);
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

  const handlersRef = useRef({});
  handlersRef.current = { handleSelect, handleFocusClick };

  useEffect(() => {
    if (!data?.people?.length || !canvasRef.current) return;
    const handle = renderFamilyTree(canvasRef.current, data.people, {
      focusId: focusIdRef.current,
      showDates: !!user,
      onSelect: (id) => handlersRef.current.handleSelect(id),
      onFocusClick: (p) => handlersRef.current.handleFocusClick(p),
    });
    treeRef.current = handle;
    return () => {
      treeRef.current = null;
      handle.destroy();
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    treeRef.current?.setFocus(focusId);
  }, [focusId]);

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
          {focusPerson && (
            <div className="text-xs font-mono text-[#687076] tracking-tight">
              Viewing: <span className="text-[#1c2024]">{focusPerson.name}</span>
            </div>
          )}
        </div>

        {/* Tree canvas */}
        {loading && !data && (
          <div className="py-24 text-center text-[#687076] font-mono text-sm rounded-2xl bg-[#fffdf8] border border-[#e2dacd]">
            Loading tree…
          </div>
        )}
        {!loading && !data?.people?.length && (
          <div className="py-24 text-center text-[#687076] text-sm rounded-2xl bg-[#fffdf8] border border-[#e2dacd]">No data yet.</div>
        )}
        <div
          ref={canvasRef}
          className={`rounded-2xl bg-[#fffdf8] border border-[#e2dacd] shadow-sm overflow-x-auto ${data?.people?.length ? "" : "hidden"}`}
          data-testid="tree-canvas"
        />

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
