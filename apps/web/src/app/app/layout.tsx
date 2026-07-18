import { BugReport } from "@/components/BugReport";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SupportWidget } from "@/components/SupportWidget";
import { SettingsLauncher } from "@/components/settings/SettingsLauncher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      {children}
      <SettingsLauncher />
      <BugReport />
      <SupportWidget />
    </>
  );
}
