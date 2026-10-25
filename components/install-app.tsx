"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/client";
import { buttonClass } from "./ui";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const noSubscription = () => () => {};
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Install button where the browser offers one (Chrome, Edge, Android), instructions elsewhere. */
export function InstallApp() {
  const { t } = useI18n();
  const standalone = useSyncExternalStore(noSubscription, isStandalone, () => false);
  const ios = useSyncExternalStore(noSubscription, isIos, () => false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) return <p className="text-sm text-muted-foreground">{t.install.installed}</p>;

  return (
    <div className="space-y-3 text-sm">
      {prompt && (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          }}
          className={buttonClass()}
        >
          {t.install.button}
        </button>
      )}
      {!prompt && <p>{ios ? t.install.ios : t.install.android}</p>}
      <p className="text-muted-foreground">{t.install.note}</p>
    </div>
  );
}
