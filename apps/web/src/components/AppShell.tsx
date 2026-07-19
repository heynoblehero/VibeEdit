"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";

/**
 * App chrome shared across every /app page: the hover-expand sidebar plus the
 * left offset content needs to clear it. The editor is a full-screen two-pane
 * workspace, so it opts out (no sidebar there).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditor = pathname?.includes("/edit") ?? false;

  if (isEditor) return <>{children}</>;

  return (
    <>
      <AppSidebar />
      <div className="md:pl-[60px]">{children}</div>
    </>
  );
}
