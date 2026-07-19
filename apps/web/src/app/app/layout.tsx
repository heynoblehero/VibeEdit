import { BugReport } from "@/components/BugReport";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SupportWidget } from "@/components/SupportWidget";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <AppShell>{children}</AppShell>
      <BugReport />
      <SupportWidget />
    </>
  );
}
