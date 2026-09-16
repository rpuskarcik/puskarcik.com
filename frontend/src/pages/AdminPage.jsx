import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [changes, setChanges] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [people, setPeople] = useState({});

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      toast.error("Admin only");
      navigate("/");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    api.get("/people").then(({ data }) => {
      const map = {};
      data.forEach((p) => (map[p.id] = p));
      setPeople(map);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const { data } = await api.get(`/admin/changes?status=${status}`);
      setChanges(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to load");
    } finally {
      setFetching(false);
    }
  }, [status]);

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user, load]);

  const approve = async (id) => {
    try {
      await api.post(`/admin/changes/${id}/approve`);
      toast.success("Approved and applied to tree");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const reject = async (id) => {
    try {
      await api.post(`/admin/changes/${id}/reject`, { reason: "" });
      toast.success("Rejected");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (loading || user?.role !== "admin") return null;

  return (
    <div className="parchment min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="text-[11px] tracking-[0.22em] uppercase text-[#9e472a] font-medium mb-2">
              Curator Panel
            </div>
            <h1 className="font-serif-display text-4xl font-semibold text-[#1c2024]">
              Pending submissions
            </h1>
          </div>
          <Button variant="outline" onClick={load} className="border-[#e2dacd]" data-testid="admin-refresh-btn">Refresh</Button>
        </div>

        <Tabs value={status} onValueChange={setStatus} className="w-full">
          <TabsList className="bg-[#f5f2ea] border border-[#e2dacd]">
            <TabsTrigger value="pending" data-testid="tab-pending"><Clock className="w-3.5 h-3.5 mr-1.5"/>Pending</TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/>Approved</TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected"><XCircle className="w-3.5 h-3.5 mr-1.5"/>Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={status} className="space-y-3 mt-4" data-testid="changes-list">
            {fetching && <div className="text-[#687076] font-mono text-sm py-8 text-center">Loading…</div>}
            {!fetching && changes.length === 0 && (
              <div className="text-[#687076] text-sm py-16 text-center italic">
                Nothing here yet.
              </div>
            )}
            {!fetching && changes.map((c) => (
              <ChangeCard
                key={c.id}
                change={c}
                people={people}
                onApprove={() => approve(c.id)}
                onReject={() => reject(c.id)}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ChangeCard({ change, people, onApprove, onReject }) {
  const kindLabels = {
    add_person: "Add person",
    edit_person: "Edit person",
    delete_person: "Delete person",
    add_relationship: "Add relationship",
    delete_relationship: "Delete relationship",
  };
  const pretty = (v) => (v == null ? "—" : String(v));
  const p = change.payload || {};

  return (
    <div className="bg-[#fffdf8] border border-[#e2dacd] rounded-xl p-5" data-testid={`change-card-${change.id}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono uppercase tracking-wider bg-[#fef3c7] text-[#92400e]">
            {kindLabels[change.kind] || change.kind}
          </span>
          <span className="text-xs text-[#687076] font-mono">
            {new Date(change.created_at).toLocaleString()}
          </span>
        </div>
        <div className="text-xs text-[#687076]">
          by <span className="text-[#1c2024]">{change.submitted_by?.name || change.submitted_by?.email}</span>
        </div>
      </div>

      <div className="mt-3 text-sm text-[#3d4147]">
        {change.kind === "add_person" && (
          <div>
            <div><span className="font-mono text-[11px] text-[#687076]">NAME:</span> {p.name} {p.gender === "M" ? "♂" : p.gender === "F" ? "♀" : ""}</div>
            <div><span className="font-mono text-[11px] text-[#687076]">DATES:</span> {pretty(p.birth_date)} — {pretty(p.death_date)}</div>
            {p.parent_id && <div><span className="font-mono text-[11px] text-[#687076]">CHILD OF:</span> {people[p.parent_id]?.name || p.parent_id}</div>}
            {p.child_id && <div><span className="font-mono text-[11px] text-[#687076]">PARENT OF:</span> {people[p.child_id]?.name || p.child_id}</div>}
            {p.spouse_id && <div><span className="font-mono text-[11px] text-[#687076]">SPOUSE OF:</span> {people[p.spouse_id]?.name || p.spouse_id}</div>}
            {p.bio && <div className="italic mt-1 text-[#687076]">{p.bio}</div>}
          </div>
        )}
        {change.kind === "edit_person" && (
          <div>
            <div><span className="font-mono text-[11px] text-[#687076]">TARGET:</span> {people[p.id]?.name || p.id}</div>
            {Object.entries(p).filter(([k]) => k !== "id").map(([k, v]) => (
              <div key={k}><span className="font-mono text-[11px] text-[#687076]">{k.toUpperCase()}:</span> {String(v)}</div>
            ))}
          </div>
        )}
        {change.kind === "add_relationship" && (
          <div>
            <div><span className="font-mono text-[11px] text-[#687076]">KIND:</span> {p.kind}</div>
            <div><span className="font-mono text-[11px] text-[#687076]">A:</span> {people[p.a_id]?.name || p.a_id}</div>
            <div><span className="font-mono text-[11px] text-[#687076]">B:</span> {people[p.b_id]?.name || p.b_id}</div>
            {p.wed_date && <div><span className="font-mono text-[11px] text-[#687076]">WEDDING:</span> {p.wed_date}</div>}
          </div>
        )}
        {change.kind === "delete_person" && (
          <div className="text-[#a3371d]">
            <span className="font-mono text-[11px] text-[#687076]">TARGET:</span> {people[p.id]?.name || p.id}
            <div className="mt-1 text-xs text-[#7c2d12]">
              Approving will permanently remove this person and every relationship attached to them.
            </div>
          </div>
        )}
      </div>

      {change.note && (
        <div className="mt-3 text-xs bg-[#f5f2ea] rounded-md px-3 py-2 text-[#4a5157] italic">
          “{change.note}”
        </div>
      )}

      {change.status === "pending" && (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            className="bg-[#065f46] hover:bg-[#064e3b] text-white"
            onClick={onApprove}
            data-testid={`approve-btn-${change.id}`}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-[#e2dacd] text-[#a3371d]"
            onClick={onReject}
            data-testid={`reject-btn-${change.id}`}
          >
            <XCircle className="w-4 h-4 mr-1.5" /> Reject
          </Button>
        </div>
      )}
      {change.status !== "pending" && (
        <div className="mt-3 text-xs font-mono text-[#687076]">
          {change.status.toUpperCase()} by {change.reviewed_by} · {change.reviewed_at && new Date(change.reviewed_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}
