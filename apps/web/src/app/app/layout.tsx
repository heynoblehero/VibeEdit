import { CommandPalette } from "@/components/CommandPalette";
import { BugReport } from "@/components/BugReport";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SupportWidget } from "@/components/SupportWidget";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      {children}
      <CommandPalette />
      <BugReport />
      <SupportWidget />
    </>
  );
}
