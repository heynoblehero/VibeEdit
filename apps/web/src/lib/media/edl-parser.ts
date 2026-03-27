/**
 * Parse EDL (Edit Decision List) files.
 * CMX 3600 format — the universal timeline exchange format.
 *
 * Format example:
 * TITLE: My Project
 * 001  001      V     C    01:00:00:00 01:00:05:00 00:00:00:00 00:00:05:00
 * * FROM CLIP NAME: intro.mp4
 * 002  002      V     C    01:00:05:00 01:00:10:00 00:00:05:00 00:00:10:00
 * * FROM CLIP NAME: main.mp4
 */

export interface EDLEvent {
	editNumber: number;
	reelId: string;
	trackType: "V" | "A" | "A2";
	transitionType: string; // C = cut, D = dissolve, W = wipe
	sourceIn: number; // seconds
	sourceOut: number;
	recordIn: number;
	recordOut: number;
	clipName?: string;
}

export interface ParsedEDL {
	title: string;
	events: EDLEvent[];
}

function parseTimecode(tc: string, fps: number = 30): number {
	const parts = tc.split(":");
	if (parts.length !== 4) return 0;
	const h = parseInt(parts[0], 10);
	const m = parseInt(parts[1], 10);
	const s = parseInt(parts[2], 10);
	const f = parseInt(parts[3], 10);
	return h * 3600 + m * 60 + s + f / fps;
}

export function parseEDL(content: string, fps: number = 30): ParsedEDL {
	const lines = content.split(/\r?\n/);
	let title = "Untitled";
	const events: EDLEvent[] = [];
	let currentEvent: EDLEvent | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Title line
		if (trimmed.startsWith("TITLE:")) {
			title = trimmed.replace("TITLE:", "").trim();
			continue;
		}

		// FCM line (frame code mode) — skip
		if (trimmed.startsWith("FCM:")) continue;

		// Event line: "001  001      V     C    01:00:00:00 01:00:05:00 00:00:00:00 00:00:05:00"
		const eventMatch = trimmed.match(
			/^(\d{3})\s+(\S+)\s+(V|A|A2|AA)\s+(\S+)\s+(\d{2}:\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2}:\d{2})/,
		);
		if (eventMatch) {
			currentEvent = {
				editNumber: parseInt(eventMatch[1], 10),
				reelId: eventMatch[2],
				trackType: eventMatch[3] as "V" | "A" | "A2",
				transitionType: eventMatch[4],
				sourceIn: parseTimecode(eventMatch[5], fps),
				sourceOut: parseTimecode(eventMatch[6], fps),
				recordIn: parseTimecode(eventMatch[7], fps),
				recordOut: parseTimecode(eventMatch[8], fps),
			};
			events.push(currentEvent);
			continue;
		}

		// Clip name comment: "* FROM CLIP NAME: intro.mp4"
		if (trimmed.startsWith("*") && currentEvent) {
			const clipMatch = trimmed.match(/\*\s*FROM CLIP NAME:\s*(.+)/i);
			if (clipMatch) {
				currentEvent.clipName = clipMatch[1].trim();
			}
		}
	}

	return { title, events };
}
