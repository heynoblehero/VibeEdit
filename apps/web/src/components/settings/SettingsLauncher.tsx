"use client";

import { useEffect, useState } from "react";
import { SettingsModal } from "./SettingsModal";

/**
 * Mounts the Settings modal app-wide and opens it on a `vibeedit:open-settings`
 * event, so any menu (dashboard, editor) can open Settings from anywhere without
 * navigating to a page.
 */
export function SettingsLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("vibeedit:open-settings", onOpen);
    return () => window.removeEventListener("vibeedit:open-settings", onOpen);
  }, []);

  if (!open) return null;
  return <SettingsModal onClose={() => setOpen(false)} />;
}
