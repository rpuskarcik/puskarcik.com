import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form.email, form.password, form.name);
      toast.success("Account created — you can now propose changes");
      navigate("/");
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="parchment min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#fffdf8] rounded-2xl border border-[#e2dacd] p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="text-[11px] tracking-[0.22em] uppercase text-[#9e472a] font-medium mb-2">
            Become a Contributor
          </div>
          <h1 className="font-serif-display text-3xl font-semibold text-[#1c2024]">
            Join the archive
          </h1>
          <p className="text-sm text-[#687076] mt-2">
            All edits go to the family curator for approval before appearing on the tree.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4" data-testid="register-form">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 bg-white border-[#e2dacd]"
              required
              data-testid="register-name-input"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 bg-white border-[#e2dacd]"
              required
              data-testid="register-email-input"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 bg-white border-[#e2dacd]"
              required
              minLength={6}
              data-testid="register-password-input"
            />
          </div>
          {error && (
            <div className="text-sm text-[#a3371d] bg-[#fdf0ed] border border-[#f4c9c1] rounded px-3 py-2" data-testid="register-error">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="w-full bg-[#9e472a] hover:bg-[#7c2d12] text-[#fbf9f5]"
            disabled={loading}
            data-testid="register-submit-btn"
          >
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-[#687076]">
          Already registered?{" "}
          <Link to="/login" className="text-[#9e472a] hover:underline" data-testid="go-login-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
