/**
 * Parse FCPXML (Final Cut Pro XML) and Premiere Pro XML timeline files.
 * Extracts clip timings, track layout, and basic metadata.
 */

export interface XMLClip {
	name: string;
	startTime: number; // seconds on timeline
	duration: number; // seconds
	sourceIn: number; // trim start in source
	sourceFile?: string; // source filename
	trackIndex: number;
	type: "video" | "audio" | "title";
}

export interface ParsedTimeline {
	name: string;
	fps: number;
	duration: number;
	clips: XMLClip[];
}

function parseRationalTime(value: string, fps: number): number {
	// Handles formats like "1001/30000s" or "10s" or "300/30s"
	const match = value.match(/^(\d+)\/(\d+)s$/);
	if (match) {
		return parseInt(match[1], 10) / parseInt(match[2], 10);
	}
	const simpleMatch = value.match(/^([\d.]+)s$/);
	if (simpleMatch) {
		return parseFloat(simpleMatch[1]);
	}
	// Try as frame count
	const frameMatch = value.match(/^(\d+)$/);
	if (frameMatch) {
		return parseInt(frameMatch[1], 10) / fps;
	}
	return 0;
}

export function parseFCPXML(content: string): ParsedTimeline {
	const parser = new DOMParser();
	const doc = parser.parseFromString(content, "text/xml");

	const clips: XMLClip[] = [];
	let timelineName = "Imported Timeline";
	let fps = 30;
	let totalDuration = 0;

	// Try FCPXML format (Final Cut Pro)
	const fcpxml = doc.querySelector("fcpxml");
	if (fcpxml) {
		const project = doc.querySelector("project");
		if (project)
			timelineName = project.getAttribute("name") || timelineName;

		const sequence = doc.querySelector("sequence");
		if (sequence) {
			const format = sequence.getAttribute("format");
			// Try to extract fps from format
			const fpsAttr = doc
				.querySelector(`format[id="${format}"]`)
				?.getAttribute("frameDuration");
			if (fpsAttr) {
				const parsed = parseRationalTime(fpsAttr, 30);
				if (parsed > 0) fps = Math.round(1 / parsed);
			}
		}

		// Extract clips
		let trackIndex = 0;
		const spines = doc.querySelectorAll("spine");
		for (const spine of spines) {
			const children = spine.children;
			let offset = 0;
			for (const child of children) {
				const name = child.getAttribute("name") || child.tagName;
				const durationAttr = child.getAttribute("duration");
				const startAttr = child.getAttribute("start");
				const duration = durationAttr
					? parseRationalTime(durationAttr, fps)
					: 0;
				const startOffset = startAttr
					? parseRationalTime(startAttr, fps)
					: 0;

				if (duration > 0) {
					const type =
						child.tagName === "audio" ||
						child.tagName === "assetAudio"
							? "audio"
							: child.tagName === "title"
								? "title"
								: "video";

					clips.push({
						name,
						startTime: offset,
						duration,
						sourceIn: startOffset,
						trackIndex,
						type,
					});
					offset += duration;
					totalDuration = Math.max(totalDuration, offset);
				}
			}
			trackIndex++;
		}
	}

	// Try Premiere Pro XML format
	const xmeml = doc.querySelector("xmeml");
	if (xmeml) {
		const seq = doc.querySelector("sequence");
		if (seq) {
			timelineName =
				seq.querySelector("name")?.textContent || timelineName;
			const rateEl = seq.querySelector("rate > timebase");
			if (rateEl) fps = parseInt(rateEl.textContent || "30", 10);
		}

		let trackIndex = 0;
		const tracks = doc.querySelectorAll("track");
		for (const track of tracks) {
			const clipItems = track.querySelectorAll("clipitem");
			for (const item of clipItems) {
				const name =
					item.querySelector("name")?.textContent || "Untitled";
				const startFrame = parseInt(
					item.querySelector("start")?.textContent || "0",
					10,
				);
				const endFrame = parseInt(
					item.querySelector("end")?.textContent || "0",
					10,
				);
				const inFrame = parseInt(
					item.querySelector("in")?.textContent || "0",
					10,
				);
				const sourceFile =
					item.querySelector("file name")?.textContent;

				const isAudio = track.closest("audio") !== null;

				if (endFrame > startFrame) {
					const clip: XMLClip = {
						name,
						startTime: startFrame / fps,
						duration: (endFrame - startFrame) / fps,
						sourceIn: inFrame / fps,
						sourceFile: sourceFile ?? undefined,
						trackIndex,
						type: isAudio ? "audio" : "video",
					};
					clips.push(clip);
					totalDuration = Math.max(
						totalDuration,
						clip.startTime + clip.duration,
					);
				}
			}
			trackIndex++;
		}
	}

	return { name: timelineName, fps, duration: totalDuration, clips };
}
