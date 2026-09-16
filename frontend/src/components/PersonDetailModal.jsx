import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function PersonDetailModal({ open, person, onClose, onBack, canGoBack }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!person) return null;
  const symbol = person.gender === "M" ? "♂" : person.gender === "F" ? "♀" : "•";
  const genderClass = person.gender === "M" ? "gender-M" : person.gender === "F" ? "gender-F" : "gender-O";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg bg-[#fffdf8] border-[#e2dacd]"
        data-testid="person-detail-modal"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            {canGoBack ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-[#9e472a] hover:bg-[#f5f2ea] -ml-2"
                data-testid="modal-back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to previous tree
              </Button>
            ) : (
              <div />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-[#687076]"
              data-testid="modal-close-btn"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogTitle className="text-left">
            <div className="flex items-center gap-3 pt-2">
              <span className={`gender-badge ${genderClass}`} style={{ width: 32, height: 32, fontSize: 16 }}>
                {symbol}
              </span>
              <div>
                <div className="font-serif-display text-2xl font-semibold text-[#1c2024]">
                  {person.name}
                </div>
                <div className="font-mono text-xs text-[#687076] mt-0.5">
                  {(person.birth_date || "?")} — {(person.death_date || "living")}
                </div>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed record for {person.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {(person.birth_place || person.death_place) && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {person.birth_place && (
                <div>
                  <div className="text-[10px] tracking-[0.18em] uppercase text-[#687076] mb-0.5">Born in</div>
                  <div className="text-[#1c2024]">{person.birth_place}</div>
                </div>
              )}
              {person.death_place && (
                <div>
                  <div className="text-[10px] tracking-[0.18em] uppercase text-[#687076] mb-0.5">Died in</div>
                  <div className="text-[#1c2024]">{person.death_place}</div>
                </div>
              )}
            </div>
          )}
          {person.bio && (
            <div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-[#687076] mb-1">Biography</div>
              <p className="text-[15px] leading-relaxed text-[#3d4147] font-serif-display">
                {person.bio}
              </p>
            </div>
          )}
          {!person.bio && !person.birth_place && !person.death_place && (
            <p className="text-sm text-[#687076] italic">No additional details recorded yet.</p>
          )}

          {user && (
            <div className="pt-2 border-t border-[#e2dacd]">
              <Button
                variant="outline"
                size="sm"
                className="border-[#e2dacd] text-[#9e472a] hover:bg-[#fdf0ed]"
                onClick={() => {
                  onClose();
                  navigate(`/contribute?edit=${person.id}`);
                }}
                data-testid="modal-edit-btn"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Propose an edit
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
