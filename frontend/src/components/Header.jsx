import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck, PlusCircle } from "lucide-react";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 border-b border-[#e2dacd] backdrop-blur"
      style={{ background: "rgba(251,249,245,0.85)" }}
      data-testid="site-header"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="site-logo-link">
          <div className="w-9 h-9 rounded-full bg-[#9e472a] text-[#fbf9f5] flex items-center justify-center font-serif-display text-lg font-semibold">
            P
          </div>
          <div className="leading-tight">
            <div className="font-serif-display text-lg font-semibold text-[#1c2024]">
              Puskarcik
            </div>
            <div className="text-[11px] tracking-[0.18em] text-[#687076] uppercase">
              Family Tree
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-[#4a5157]" data-testid="user-name">
                {user.name || user.email}
              </span>
              {user.role === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#e2dacd] text-[#1c2024] hover:bg-[#f5f2ea]"
                  onClick={() => navigate("/admin")}
                  data-testid="admin-panel-btn"
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Admin
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="border-[#e2dacd] text-[#1c2024] hover:bg-[#f5f2ea]"
                onClick={() => navigate("/contribute")}
                data-testid="contribute-btn"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Contribute
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
                data-testid="login-nav-btn"
              >
                Sign in
              </Button>
              <Button
                size="sm"
                className="bg-[#9e472a] hover:bg-[#7c2d12] text-[#fbf9f5]"
                onClick={() => navigate("/register")}
                data-testid="register-nav-btn"
              >
                Contribute
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
