import { CommandPalette } from "@/components/CommandPalette";
import { BugReport } from "@/components/BugReport";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			{children}
			<CommandPalette />
			<BugReport />
		</>
	);
}
