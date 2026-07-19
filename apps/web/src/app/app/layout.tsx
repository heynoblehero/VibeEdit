import { BugReport } from "@/components/BugReport";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SupportWidget } from "@/components/SupportWidget";
import { SettingsLauncher } from "@/components/settings/SettingsLauncher";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <AppShell>{children}</AppShell>
      <SettingsLauncher />
      <BugReport />
      <SupportWidget />
    </>
  );
}
