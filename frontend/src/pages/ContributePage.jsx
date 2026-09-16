import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function ContributePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editParamId = searchParams.get("edit");
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [applyNow, setApplyNow] = useState(false);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  useEffect(() => {
    api.get("/people").then(({ data }) => setPeople(data)).catch(() => {});
  }, []);

  const submitChange = async (kind, payload, note) => {
    setError("");
    try {
      if (isAdmin && applyNow) {
        // Bypass approval queue and hit direct admin endpoints
        if (kind === "add_person") {
          const { data: created } = await api.post("/admin/people", payload);
          // If connection fields present, add relationship(s) directly
          if (payload.parent_id) {
            await api.post("/admin/relationships", { kind: "parent_child", a_id: payload.parent_id, b_id: created.id });
          }
          if (payload.child_id) {
            await api.post("/admin/relationships", { kind: "parent_child", a_id: created.id, b_id: payload.child_id });
          }
          if (payload.spouse_id) {
            await api.post("/admin/relationships", { kind: "spouse", a_id: created.id, b_id: payload.spouse_id, wed_date: payload.wed_date });
          }
        } else if (kind === "edit_person") {
          const { id, ...rest } = payload;
          await api.patch(`/admin/people/${id}`, rest);
        } else if (kind === "delete_person") {
          await api.delete(`/admin/people/${payload.id}`);
        } else if (kind === "add_relationship") {
          await api.post("/admin/relationships", payload);
        }
        toast.success("Applied immediately");
      } else {
        await api.post("/changes", { kind, payload, note });
        toast.success("Submitted for admin review");
      }
      return true;
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
      return false;
    }
  };

  if (loading || !user) return null;

  const defaultTab = editParamId ? "edit" : "add";

  return (
    <div className="parchment min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="mb-8">
          <div className="text-[11px] tracking-[0.22em] uppercase text-[#9e472a] font-medium mb-2">
            Contributor Portal
          </div>
          <h1 className="font-serif-display text-4xl font-semibold text-[#1c2024]">
            Propose an update
          </h1>
          <p className="text-[#687076] mt-2">
            {isAdmin
              ? "As curator, you can submit for review OR apply changes immediately."
              : "Every submission is queued for approval by the family curator."}
          </p>
        </div>

        {isAdmin && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-[#fdf0ed] border border-[#f4c9c1] rounded-md">
            <Checkbox
              id="apply-now"
              checked={applyNow}
              onCheckedChange={(v) => setApplyNow(!!v)}
              data-testid="admin-apply-now"
            />
            <Label htmlFor="apply-now" className="text-sm text-[#7c2d12] cursor-pointer">
              Apply changes immediately (skip approval queue)
            </Label>
          </div>
        )}

        {error && (
          <div className="text-sm text-[#a3371d] bg-[#fdf0ed] border border-[#f4c9c1] rounded px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-[#f5f2ea] border border-[#e2dacd]">
            <TabsTrigger value="add" data-testid="tab-add-person">Add person</TabsTrigger>
            <TabsTrigger value="edit" data-testid="tab-edit-person">Edit person</TabsTrigger>
            <TabsTrigger value="delete" data-testid="tab-delete-person">Delete</TabsTrigger>
            <TabsTrigger value="rel" data-testid="tab-add-rel">Add relationship</TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <AddPersonForm people={people} onSubmit={submitChange} />
          </TabsContent>
          <TabsContent value="edit">
            <EditPersonForm people={people} onSubmit={submitChange} initialId={editParamId} />
          </TabsContent>
          <TabsContent value="delete">
            <DeletePersonForm people={people} onSubmit={submitChange} />
          </TabsContent>
          <TabsContent value="rel">
            <AddRelForm people={people} onSubmit={submitChange} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AddPersonForm({ people, onSubmit }) {
  const [form, setForm] = useState({
    name: "", gender: "M", birth_date: "", death_date: "",
    birth_place: "", death_place: "", bio: "",
    connectionType: "none", connectionPersonId: "",
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name, gender: form.gender,
      birth_date: form.birth_date || null, death_date: form.death_date || null,
      birth_place: form.birth_place || null, death_place: form.death_place || null,
      bio: form.bio || null,
    };
    if (form.connectionType === "parent" && form.connectionPersonId) payload.child_id = form.connectionPersonId;
    if (form.connectionType === "child" && form.connectionPersonId) payload.parent_id = form.connectionPersonId;
    if (form.connectionType === "spouse" && form.connectionPersonId) payload.spouse_id = form.connectionPersonId;
    const ok = await onSubmit("add_person", payload, note);
    setBusy(false);
    if (ok) setForm({ ...form, name: "", birth_date: "", death_date: "", birth_place: "", death_place: "", bio: "" });
  };

  return (
    <form onSubmit={submit} className="bg-[#fffdf8] border border-[#e2dacd] rounded-2xl p-6 mt-4 space-y-4" data-testid="add-person-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Name *</Label>
          <Input value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="ap-name" />
        </div>
        <div>
          <Label>Gender *</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger data-testid="ap-gender"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Male ♂</SelectItem>
              <SelectItem value="F">Female ♀</SelectItem>
              <SelectItem value="O">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Birth date</Label>
          <Input value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} placeholder="e.g. 1925 or 1925-06-14" data-testid="ap-birth" />
        </div>
        <div>
          <Label>Death date</Label>
          <Input value={form.death_date} onChange={(e) => setForm({ ...form, death_date: e.target.value })} data-testid="ap-death" />
        </div>
        <div>
          <Label>Birth place</Label>
          <Input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} data-testid="ap-bplace" />
        </div>
        <div>
          <Label>Death place</Label>
          <Input value={form.death_place} onChange={(e) => setForm({ ...form, death_place: e.target.value })} data-testid="ap-dplace" />
        </div>
      </div>
      <div>
        <Label>Biography</Label>
        <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="ap-bio" />
      </div>
      <div className="border-t border-[#e2dacd] pt-4">
        <Label className="text-[#1c2024]">Connect to existing person (optional)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Select value={form.connectionType} onValueChange={(v) => setForm({ ...form, connectionType: v })}>
            <SelectTrigger data-testid="ap-conn-type"><SelectValue placeholder="No connection" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No connection</SelectItem>
              <SelectItem value="parent">Is a parent of…</SelectItem>
              <SelectItem value="child">Is a child of…</SelectItem>
              <SelectItem value="spouse">Is a spouse of…</SelectItem>
            </SelectContent>
          </Select>
          {form.connectionType !== "none" && (
            <Select value={form.connectionPersonId} onValueChange={(v) => setForm({ ...form, connectionPersonId: v })}>
              <SelectTrigger data-testid="ap-conn-person"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div>
        <Label>Note to curator (optional)</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} data-testid="ap-note" />
      </div>
      <Button type="submit" disabled={busy} className="bg-[#9e472a] hover:bg-[#7c2d12] text-[#fbf9f5]" data-testid="ap-submit">
        {busy ? "Submitting…" : "Submit for review"}
      </Button>
    </form>
  );
}

function EditPersonForm({ people, onSubmit, initialId }) {
  const [id, setId] = useState(initialId || "");
  const [fields, setFields] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialId) setId(initialId);
  }, [initialId]);

  const chosen = people.find((p) => p.id === id);

  const submit = async (e) => {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    const payload = { id, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== "")) };
    const ok = await onSubmit("edit_person", payload, note);
    setBusy(false);
    if (ok) { setFields({}); }
  };

  return (
    <form onSubmit={submit} className="bg-[#fffdf8] border border-[#e2dacd] rounded-2xl p-6 mt-4 space-y-4" data-testid="edit-person-form">
      <div>
        <Label>Choose a person</Label>
        <Select value={id} onValueChange={setId}>
          <SelectTrigger data-testid="ep-person"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {chosen && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input placeholder={chosen.name} value={fields.name || ""} onChange={(e) => setFields({ ...fields, name: e.target.value })} data-testid="ep-name" />
            </div>
            <div>
              <Label>Birth date</Label>
              <Input placeholder={chosen.birth_date || "—"} value={fields.birth_date || ""} onChange={(e) => setFields({ ...fields, birth_date: e.target.value })} data-testid="ep-birth" />
            </div>
            <div>
              <Label>Death date</Label>
              <Input placeholder={chosen.death_date || "—"} value={fields.death_date || ""} onChange={(e) => setFields({ ...fields, death_date: e.target.value })} data-testid="ep-death" />
            </div>
            <div>
              <Label>Birth place</Label>
              <Input value={fields.birth_place || ""} onChange={(e) => setFields({ ...fields, birth_place: e.target.value })} data-testid="ep-bplace" />
            </div>
          </div>
          <div>
            <Label>Biography</Label>
            <Textarea rows={3} value={fields.bio || ""} onChange={(e) => setFields({ ...fields, bio: e.target.value })} data-testid="ep-bio" />
          </div>
          <div>
            <Label>Note to curator</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} data-testid="ep-note" />
          </div>
          <Button type="submit" disabled={busy} className="bg-[#9e472a] hover:bg-[#7c2d12] text-[#fbf9f5]" data-testid="ep-submit">
            {busy ? "Submitting…" : "Submit edit for review"}
          </Button>
        </>
      )}
    </form>
  );
}

function AddRelForm({ people, onSubmit }) {
  const [form, setForm] = useState({ kind: "parent_child", a_id: "", b_id: "", wed_date: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.a_id || !form.b_id) return;
    setBusy(true);
    const payload = { kind: form.kind, a_id: form.a_id, b_id: form.b_id };
    if (form.kind === "spouse" && form.wed_date) payload.wed_date = form.wed_date;
    const ok = await onSubmit("add_relationship", payload, note);
    setBusy(false);
    if (ok) setForm({ ...form, a_id: "", b_id: "", wed_date: "" });
  };

  return (
    <form onSubmit={submit} className="bg-[#fffdf8] border border-[#e2dacd] rounded-2xl p-6 mt-4 space-y-4" data-testid="add-rel-form">
      <div>
        <Label>Relationship</Label>
        <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
          <SelectTrigger data-testid="ar-kind"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="parent_child">Parent → Child</SelectItem>
            <SelectItem value="spouse">Spouse ↔ Spouse</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{form.kind === "parent_child" ? "Parent" : "Spouse A"}</Label>
          <Select value={form.a_id} onValueChange={(v) => setForm({ ...form, a_id: v })}>
            <SelectTrigger data-testid="ar-a"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{form.kind === "parent_child" ? "Child" : "Spouse B"}</Label>
          <Select value={form.b_id} onValueChange={(v) => setForm({ ...form, b_id: v })}>
            <SelectTrigger data-testid="ar-b"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {form.kind === "spouse" && (
        <div>
          <Label>Wedding date (optional)</Label>
          <Input
            value={form.wed_date}
            onChange={(e) => setForm({ ...form, wed_date: e.target.value })}
            placeholder="e.g. 1938 or 1938-06-14"
            data-testid="ar-wed-date"
          />
        </div>
      )}
      <div>
        <Label>Note to curator</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} data-testid="ar-note" />
      </div>
      <Button type="submit" disabled={busy} className="bg-[#9e472a] hover:bg-[#7c2d12] text-[#fbf9f5]" data-testid="ar-submit">
        {busy ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}

function DeletePersonForm({ people, onSubmit }) {
  const [id, setId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = people.find((p) => p.id === id);

  const submit = async (e) => {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    const ok = await onSubmit("delete_person", { id }, reason);
    setBusy(false);
    if (ok) { setId(""); setReason(""); }
  };

  return (
    <form onSubmit={submit} className="bg-[#fffdf8] border border-[#e2dacd] rounded-2xl p-6 mt-4 space-y-4" data-testid="delete-person-form">
      <div>
        <Label>Person to delete</Label>
        <Select value={id} onValueChange={setId}>
          <SelectTrigger data-testid="dp-person"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {chosen && (
        <div className="text-sm text-[#7c2d12] bg-[#fdf0ed] border border-[#f4c9c1] rounded px-3 py-2">
          This will remove <span className="font-semibold">{chosen.name}</span> and every parent/child/spouse relationship attached to them.
        </div>
      )}
      <div>
        <Label>Reason (required)</Label>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. duplicate entry from test data"
          required
          data-testid="dp-reason"
        />
      </div>
      <Button type="submit" disabled={busy || !id || !reason} className="bg-[#a3371d] hover:bg-[#7c2d12] text-white" data-testid="dp-submit">
        {busy ? "Submitting…" : "Submit deletion"}
      </Button>
    </form>
  );
}
