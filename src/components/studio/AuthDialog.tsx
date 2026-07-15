import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockStudio, type StudioAuthState } from "@/lib/studioAuth";
import { cn } from "@/lib/utils";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock: (auth: StudioAuthState) => void;
}

export function AuthDialog({ open, onOpenChange, onUnlock }: AuthDialogProps) {
  const [password, setPassword] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
  }, [open]);

  const unlock = async () => {
    const trimmedKey = geminiKey.trim();

    if (!password || !trimmedKey) {
      setError("Paste your Gemini API key to continue.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const auth = await unlockStudio({
        data: {
          password,
          geminiApiKey: trimmedKey,
        },
      });

      if ("error" in auth && auth.error) {
        setError(auth.error);
        return;
      }

      onUnlock(auth);
      onOpenChange(false);
      setPassword("");
      setGeminiKey("");
      setShowPassword(false);
      setShowKey(false);
      setError("");
    } catch {
      setError(
        "Secure login needs the backend server. GitHub Pages can show the static studio, but Gemini key login requires a server deployment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-7 py-6 text-left">
          <DialogTitle className="font-display text-2xl">Unlock PhotoShoot Studio</DialogTitle>
        </DialogHeader>

        <div className="px-7 py-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>

          <div className="mx-auto max-w-md text-center">
            <h2 className="text-xl font-semibold">Access Required</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter your access code and your personal Gemini API key to continue. On GitHub Pages, your key is kept only for this browser session.
            </p>
          </div>

          <div className="mx-auto mt-7 max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studio-password">Access Password</Label>
              <div className="relative">
                <Input
                  id="studio-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={cn("h-12 rounded-xl pr-11", error && "border-destructive")}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="gemini-api-key">Gemini API Key</Label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Get a free key
                </a>
              </div>
              <div className="relative">
                <Input
                  id="gemini-api-key"
                  type={showKey ? "text" : "password"}
                  value={geminiKey}
                  onChange={(event) => setGeminiKey(event.target.value)}
                  placeholder="Enter your API key..."
                  className="h-12 rounded-xl pr-11 font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your key is not saved to the repo or a server. It is used from this browser session to call Gemini.
              </p>
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          </div>
        </div>

        <DialogFooter className="gap-3 px-7 pb-7">
          <Button variant="soft" className="h-12 rounded-xl px-8" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="hero" className="h-12 rounded-xl px-8" onClick={unlock} disabled={submitting}>
            {submitting ? "Unlocking..." : "Unlock Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
