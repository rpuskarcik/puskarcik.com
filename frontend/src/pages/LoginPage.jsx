import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
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
            Contributor Sign In
          </div>
          <h1 className="font-serif-display text-3xl font-semibold text-[#1c2024]">
            Welcome back
          </h1>
        </div>
        <form onSubmit={submit} className="space-y-4" data-testid="login-form">
          <div>
            <Label htmlFor="email" className="text-[#1c2024]">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-white border-[#e2dacd]"
              required
              data-testid="login-email-input"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-[#1c2024]">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 bg-white border-[#e2dacd]"
              required
              data-testid="login-password-input"
            />
          </div>
          {error && (
            <div className="text-sm text-[#a3371d] bg-[#fdf0ed] border border-[#f4c9c1] rounded px-3 py-2" data-testid="login-error">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="w-full bg-[#9e472a] hover:bg-[#7c2d12] text-[#fbf9f5]"
            disabled={loading}
            data-testid="login-submit-btn"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-[#687076]">
          New here?{" "}
          <Link to="/register" className="text-[#9e472a] hover:underline" data-testid="go-register-link">
            Create a contributor account
          </Link>
        </div>
      </div>
    </div>
  );
}
