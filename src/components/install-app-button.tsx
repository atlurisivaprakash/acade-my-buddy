import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { Button } from "@/components/ui-primitives";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-alt px-3 py-2 text-xs font-medium text-muted-foreground">
        <Check className="size-4 text-brand" />
        App installed
      </div>
    );
  }

  if (!evt) {
    return (
      <div className="text-xs text-muted-foreground">
        On iOS, tap the Share icon in Safari, then <span className="font-semibold">Add to Home Screen</span>.
        On Android/Chrome, an install prompt will appear here when supported.
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await evt.prompt();
        const { outcome } = await evt.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setEvt(null);
      }}
    >
      <Download className="size-4" />
      Install app
    </Button>
  );
}