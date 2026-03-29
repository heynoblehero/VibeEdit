import { describe, test, expect } from "bun:test";

import {
	canElementHaveAudio,
	isVisualElement,
	requiresMediaId,
	checkElementOverlaps,
	resolveElementOverlaps,
	wouldElementOverlap,
	buildTextElement,
	buildVideoElement,
	buildImageElement,
	buildUploadAudioElement,
	buildElementFromMedia,
	buildStickerElement,
	getElementsAtTime,
	collectFontFamilies,
} from "@/lib/timeline/element-utils";

import {
	canElementGoOnTrack,
	buildEmptyTrack,
	getDefaultInsertIndexForTrack,
	validateElementTrackCompatibility,
	enforceMainTrackStart,
	isMainTrack,
} from "@/lib/timeline/track-utils";

import {
	findSnapPoints,
	snapToNearestPoint,
	snapElementEdge,
} from "@/lib/timeline/snap-utils";

import {
	getTimelinePixelsPerSecond,
	timelineTimeToPixels,
} from "@/lib/timeline/pixel-utils";

import {
	getRulerConfig,
	shouldShowLabel,
	formatRulerLabel,
} from "@/lib/timeline/ruler-utils";

import {
	getTimelineZoomMin,
	sliderToZoom,
	zoomToSlider,
} from "@/lib/timeline/zoom-utils";

import {
	findBookmarkIndex,
	isBookmarkAtTime,
} from "@/lib/timeline/bookmarks";

import { rippleShiftElements } from "@/lib/timeline/ripple-utils";

import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

import type {
	TimelineElement,
	TimelineTrack,
	VideoTrack,
	AudioTrack,
	TextTrack,
	StickerTrack,
	EffectTrack,
	VideoElement,
	ImageElement,
	TextElement,
	AudioElement,
	StickerElement,
	EffectElement,
	Bookmark,
} from "@/types/timeline";

// ---------------------------------------------------------------------------
// Helpers to build mock elements / tracks
// ---------------------------------------------------------------------------

function mockVideoElement(overrides: Partial<VideoElement> = {}): VideoElement {
	return {
		id: "vid-1",
		type: "video",
		mediaId: "media-1",
		name: "clip.mp4",
		duration: 5,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		muted: false,
		hidden: false,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		blendMode: "normal",
		...overrides,
	};
}

function mockImageElement(overrides: Partial<ImageElement> = {}): ImageElement {
	return {
		id: "img-1",
		type: "image",
		mediaId: "media-2",
		name: "photo.png",
		duration: 5,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		hidden: false,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		blendMode: "normal",
		...overrides,
	};
}

function mockTextElement(overrides: Partial<TextElement> = {}): TextElement {
	return {
		id: "txt-1",
		type: "text",
		name: "Text",
		content: "Hello",
		duration: 5,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		fontSize: 15,
		fontFamily: "Arial",
		color: "#ffffff",
		background: {
			enabled: false,
			color: "#000000",
		},
		textAlign: "center",
		fontWeight: "normal",
		fontStyle: "normal",
		textDecoration: "none",
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		blendMode: "normal",
		...overrides,
	};
}

function mockAudioElement(
	overrides: Partial<AudioElement> = {},
): AudioElement {
	return {
		id: "aud-1",
		type: "audio",
		sourceType: "upload",
		mediaId: "media-3",
		name: "song.mp3",
		duration: 10,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		volume: 1,
		muted: false,
		...overrides,
	} as AudioElement;
}

function mockStickerElement(
	overrides: Partial<StickerElement> = {},
): StickerElement {
	return {
		id: "stk-1",
		type: "sticker",
		stickerId: "pack:emoji-smile",
		name: "emoji smile",
		duration: 5,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		blendMode: "normal",
		...overrides,
	};
}

function mockEffectElement(
	overrides: Partial<EffectElement> = {},
): EffectElement {
	return {
		id: "fx-1",
		type: "effect",
		effectType: "blur",
		name: "Blur",
		params: {},
		duration: 5,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		...overrides,
	};
}

function mockVideoTrack(overrides: Partial<VideoTrack> = {}): VideoTrack {
	return {
		id: "track-v1",
		name: "Video track",
		type: "video",
		elements: [],
		isMain: false,
		muted: false,
		hidden: false,
		...overrides,
	};
}

function mockMainTrack(overrides: Partial<VideoTrack> = {}): VideoTrack {
	return mockVideoTrack({ id: "track-main", isMain: true, ...overrides });
}

function mockAudioTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
	return {
		id: "track-a1",
		name: "Audio track",
		type: "audio",
		elements: [],
		muted: false,
		...overrides,
	};
}

function mockTextTrack(overrides: Partial<TextTrack> = {}): TextTrack {
	return {
		id: "track-t1",
		name: "Text track",
		type: "text",
		elements: [],
		hidden: false,
		...overrides,
	};
}

function mockStickerTrack(
	overrides: Partial<StickerTrack> = {},
): StickerTrack {
	return {
		id: "track-s1",
		name: "Sticker track",
		type: "sticker",
		elements: [],
		hidden: false,
		...overrides,
	};
}

function mockEffectTrack(overrides: Partial<EffectTrack> = {}): EffectTrack {
	return {
		id: "track-e1",
		name: "Effect track",
		type: "effect",
		elements: [],
		hidden: false,
		...overrides,
	};
}

// ===================================================================
// 1. element-utils.ts
// ===================================================================

describe("element-utils", () => {
	// ---- canElementHaveAudio ----
	describe("canElementHaveAudio", () => {
		test("returns true for audio elements", () => {
			expect(canElementHaveAudio(mockAudioElement())).toBe(true);
		});

		test("returns true for video elements", () => {
			expect(canElementHaveAudio(mockVideoElement())).toBe(true);
		});

		test("returns false for text elements", () => {
			expect(canElementHaveAudio(mockTextElement())).toBe(false);
		});

		test("returns false for image elements", () => {
			expect(canElementHaveAudio(mockImageElement())).toBe(false);
		});

		test("returns false for sticker elements", () => {
			expect(canElementHaveAudio(mockStickerElement())).toBe(false);
		});

		test("returns false for effect elements", () => {
			expect(canElementHaveAudio(mockEffectElement())).toBe(false);
		});
	});

	// ---- isVisualElement ----
	describe("isVisualElement", () => {
		test("returns true for video", () => {
			expect(isVisualElement(mockVideoElement())).toBe(true);
		});

		test("returns true for image", () => {
			expect(isVisualElement(mockImageElement())).toBe(true);
		});

		test("returns true for text", () => {
			expect(isVisualElement(mockTextElement())).toBe(true);
		});

		test("returns true for sticker", () => {
			expect(isVisualElement(mockStickerElement())).toBe(true);
		});

		test("returns false for audio", () => {
			expect(isVisualElement(mockAudioElement())).toBe(false);
		});

		test("returns false for effect", () => {
			expect(isVisualElement(mockEffectElement())).toBe(false);
		});
	});

	// ---- requiresMediaId ----
	describe("requiresMediaId", () => {
		test("returns true for video element", () => {
			expect(
				requiresMediaId({
					element: { type: "video" } as any,
				}),
			).toBe(true);
		});

		test("returns true for image element", () => {
			expect(
				requiresMediaId({
					element: { type: "image" } as any,
				}),
			).toBe(true);
		});

		test("returns true for upload audio element", () => {
			expect(
				requiresMediaId({
					element: { type: "audio", sourceType: "upload" } as any,
				}),
			).toBe(true);
		});

		test("returns false for library audio element", () => {
			expect(
				requiresMediaId({
					element: { type: "audio", sourceType: "library" } as any,
				}),
			).toBe(false);
		});

		test("returns false for text element", () => {
			expect(
				requiresMediaId({
					element: { type: "text" } as any,
				}),
			).toBe(false);
		});

		test("returns false for sticker element", () => {
			expect(
				requiresMediaId({
					element: { type: "sticker" } as any,
				}),
			).toBe(false);
		});
	});

	// ---- checkElementOverlaps ----
	describe("checkElementOverlaps", () => {
		test("returns false for empty array", () => {
			expect(checkElementOverlaps({ elements: [] })).toBe(false);
		});

		test("returns false for single element", () => {
			const el = mockVideoElement({ startTime: 0, duration: 5 });
			expect(checkElementOverlaps({ elements: [el] })).toBe(false);
		});

		test("returns false for non-overlapping elements", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 0,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 5,
				duration: 5,
			});
			expect(checkElementOverlaps({ elements: [el1, el2] })).toBe(false);
		});

		test("returns true for overlapping elements", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 0,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 3,
				duration: 5,
			});
			expect(checkElementOverlaps({ elements: [el1, el2] })).toBe(true);
		});

		test("detects overlap regardless of input order", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 3,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 0,
				duration: 5,
			});
			expect(checkElementOverlaps({ elements: [el1, el2] })).toBe(true);
		});

		test("touching edges (no gap) do not count as overlap", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 0,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 5,
				duration: 3,
			});
			expect(checkElementOverlaps({ elements: [el1, el2] })).toBe(false);
		});
	});

	// ---- resolveElementOverlaps ----
	describe("resolveElementOverlaps", () => {
		test("returns empty array for empty input", () => {
			expect(resolveElementOverlaps({ elements: [] })).toEqual([]);
		});

		test("does not modify non-overlapping elements", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 0,
				duration: 3,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 5,
				duration: 3,
			});
			const result = resolveElementOverlaps({ elements: [el1, el2] });
			expect(result[0].startTime).toBe(0);
			expect(result[1].startTime).toBe(5);
		});

		test("pushes overlapping element to end of previous", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 0,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 3,
				duration: 5,
			});
			const result = resolveElementOverlaps({ elements: [el1, el2] });
			expect(result[0].startTime).toBe(0);
			expect(result[1].startTime).toBe(5);
		});

		test("cascades resolution through multiple overlapping elements", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 0,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 2,
				duration: 5,
			});
			const el3 = mockVideoElement({
				id: "c",
				startTime: 4,
				duration: 5,
			});
			const result = resolveElementOverlaps({
				elements: [el1, el2, el3],
			});
			expect(result[0].startTime).toBe(0);
			expect(result[1].startTime).toBe(5);
			expect(result[2].startTime).toBe(10);
		});

		test("does not mutate the original elements", () => {
			const el1 = mockVideoElement({
				id: "a",
				startTime: 0,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "b",
				startTime: 3,
				duration: 5,
			});
			resolveElementOverlaps({ elements: [el1, el2] });
			expect(el2.startTime).toBe(3);
		});
	});

	// ---- wouldElementOverlap ----
	describe("wouldElementOverlap", () => {
		test("returns false for empty elements", () => {
			expect(
				wouldElementOverlap({
					elements: [],
					startTime: 0,
					endTime: 5,
				}),
			).toBe(false);
		});

		test("returns true when new region overlaps existing element", () => {
			const el = mockVideoElement({
				id: "a",
				startTime: 2,
				duration: 4,
			});
			expect(
				wouldElementOverlap({
					elements: [el],
					startTime: 0,
					endTime: 3,
				}),
			).toBe(true);
		});

		test("returns false when new region does not overlap", () => {
			const el = mockVideoElement({
				id: "a",
				startTime: 5,
				duration: 3,
			});
			expect(
				wouldElementOverlap({
					elements: [el],
					startTime: 0,
					endTime: 5,
				}),
			).toBe(false);
		});

		test("excludes element by id", () => {
			const el = mockVideoElement({
				id: "a",
				startTime: 2,
				duration: 4,
			});
			expect(
				wouldElementOverlap({
					elements: [el],
					startTime: 0,
					endTime: 10,
					excludeElementId: "a",
				}),
			).toBe(false);
		});

		test("touching edges do not count as overlap", () => {
			const el = mockVideoElement({
				id: "a",
				startTime: 5,
				duration: 3,
			});
			expect(
				wouldElementOverlap({
					elements: [el],
					startTime: 0,
					endTime: 5,
				}),
			).toBe(false);
		});
	});

	// ---- buildTextElement ----
	describe("buildTextElement", () => {
		test("creates a text element with defaults", () => {
			const el = buildTextElement({ raw: {}, startTime: 2 });
			expect(el.type).toBe("text");
			expect(el.startTime).toBe(2);
			expect(el.trimStart).toBe(0);
			expect(el.trimEnd).toBe(0);
			expect(el.name).toBe("Text");
			expect(el.content).toBe("Default text");
		});

		test("overrides with provided values", () => {
			const el = buildTextElement({
				raw: { content: "Custom", fontSize: 24, fontFamily: "Roboto" },
				startTime: 0,
			});
			expect(el.type).toBe("text");
			expect((el as any).content).toBe("Custom");
			expect((el as any).fontSize).toBe(24);
			expect((el as any).fontFamily).toBe("Roboto");
		});

		test("sets default duration from TIMELINE_CONSTANTS", () => {
			const el = buildTextElement({ raw: {}, startTime: 0 });
			expect(el.duration).toBe(TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION);
		});
	});

	// ---- buildVideoElement ----
	describe("buildVideoElement", () => {
		test("creates a video element with provided values", () => {
			const el = buildVideoElement({
				mediaId: "m1",
				name: "clip.mp4",
				duration: 10,
				startTime: 5,
			});
			expect(el.type).toBe("video");
			expect(el.mediaId).toBe("m1");
			expect(el.name).toBe("clip.mp4");
			expect(el.duration).toBe(10);
			expect(el.startTime).toBe(5);
			expect(el.sourceDuration).toBe(10);
			expect(el.muted).toBe(false);
			expect(el.hidden).toBe(false);
		});

		test("sets default transform and opacity", () => {
			const el = buildVideoElement({
				mediaId: "m1",
				name: "v",
				duration: 1,
				startTime: 0,
			});
			expect(el.transform).toEqual({
				scale: 1,
				position: { x: 0, y: 0 },
				rotate: 0,
			});
			expect(el.opacity).toBe(1);
		});

		test("trim values start at zero", () => {
			const el = buildVideoElement({
				mediaId: "m1",
				name: "v",
				duration: 1,
				startTime: 0,
			});
			expect(el.trimStart).toBe(0);
			expect(el.trimEnd).toBe(0);
		});
	});

	// ---- buildImageElement ----
	describe("buildImageElement", () => {
		test("creates an image element with provided values", () => {
			const el = buildImageElement({
				mediaId: "m2",
				name: "photo.jpg",
				duration: 3,
				startTime: 1,
			});
			expect(el.type).toBe("image");
			expect(el.mediaId).toBe("m2");
			expect(el.name).toBe("photo.jpg");
			expect(el.duration).toBe(3);
			expect(el.startTime).toBe(1);
		});

		test("has no sourceDuration (image-specific)", () => {
			const el = buildImageElement({
				mediaId: "m2",
				name: "photo.jpg",
				duration: 3,
				startTime: 0,
			});
			expect((el as any).sourceDuration).toBeUndefined();
		});

		test("sets hidden to false by default", () => {
			const el = buildImageElement({
				mediaId: "m2",
				name: "photo.jpg",
				duration: 3,
				startTime: 0,
			});
			expect(el.hidden).toBe(false);
		});
	});

	// ---- buildUploadAudioElement ----
	describe("buildUploadAudioElement", () => {
		test("creates an upload audio element", () => {
			const el = buildUploadAudioElement({
				mediaId: "m3",
				name: "song.mp3",
				duration: 180,
				startTime: 0,
			});
			expect(el.type).toBe("audio");
			expect(el.sourceType).toBe("upload");
			expect(el.mediaId).toBe("m3");
			expect(el.sourceDuration).toBe(180);
			expect(el.volume).toBe(1);
			expect(el.muted).toBe(false);
		});

		test("does not include buffer when not provided", () => {
			const el = buildUploadAudioElement({
				mediaId: "m3",
				name: "song.mp3",
				duration: 10,
				startTime: 0,
			});
			expect((el as any).buffer).toBeUndefined();
		});

		test("includes buffer when provided", () => {
			const fakeBuffer = {} as AudioBuffer;
			const el = buildUploadAudioElement({
				mediaId: "m3",
				name: "song.mp3",
				duration: 10,
				startTime: 0,
				buffer: fakeBuffer,
			});
			expect((el as any).buffer).toBe(fakeBuffer);
		});
	});

	// ---- buildStickerElement ----
	describe("buildStickerElement", () => {
		test("creates a sticker element with extracted name from id", () => {
			const el = buildStickerElement({
				stickerId: "pack:emoji-smile",
				startTime: 1,
			});
			expect(el.type).toBe("sticker");
			expect(el.stickerId).toBe("pack:emoji-smile");
			expect(el.name).toBe("emoji smile");
			expect(el.startTime).toBe(1);
		});

		test("uses provided name over extracted name", () => {
			const el = buildStickerElement({
				stickerId: "pack:emoji-smile",
				name: "My Sticker",
				startTime: 0,
			});
			expect(el.name).toBe("My Sticker");
		});

		test("falls back to full stickerId when no colon-separated parts", () => {
			const el = buildStickerElement({
				stickerId: "simple",
				startTime: 0,
			});
			// "simple".split(":") => ["simple"], .slice(1) => [], .pop() => undefined
			// so fallback is the stickerId itself
			expect(el.name).toBe("simple");
		});

		test("sets default duration", () => {
			const el = buildStickerElement({
				stickerId: "pack:test",
				startTime: 0,
			});
			expect(el.duration).toBe(TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION);
		});
	});

	// ---- buildEffectElement ----
	// buildEffectElement tests skipped — requires GLSL shader loading (WebGL env)

	// ---- buildElementFromMedia ----
	describe("buildElementFromMedia", () => {
		test("builds a video element for video media type", () => {
			const el = buildElementFromMedia({
				mediaId: "m1",
				mediaType: "video",
				name: "clip",
				duration: 10,
				startTime: 0,
			});
			expect(el.type).toBe("video");
		});

		test("builds an image element for image media type", () => {
			const el = buildElementFromMedia({
				mediaId: "m2",
				mediaType: "image",
				name: "photo",
				duration: 5,
				startTime: 0,
			});
			expect(el.type).toBe("image");
		});

		test("builds an audio element for audio media type", () => {
			const el = buildElementFromMedia({
				mediaId: "m3",
				mediaType: "audio",
				name: "song",
				duration: 180,
				startTime: 0,
			});
			expect(el.type).toBe("audio");
		});
	});

	// ---- getElementsAtTime ----
	describe("getElementsAtTime", () => {
		test("returns empty array when no tracks", () => {
			expect(getElementsAtTime({ tracks: [], time: 5 })).toEqual([]);
		});

		test("returns elements that contain the given time (exclusive boundaries)", () => {
			const el = mockVideoElement({
				id: "vid-1",
				startTime: 2,
				duration: 5,
			});
			const track = mockVideoTrack({
				id: "t1",
				elements: [el],
			});
			const result = getElementsAtTime({ tracks: [track], time: 4 });
			expect(result).toEqual([{ trackId: "t1", elementId: "vid-1" }]);
		});

		test("excludes elements at exact start boundary", () => {
			const el = mockVideoElement({
				id: "vid-1",
				startTime: 2,
				duration: 5,
			});
			const track = mockVideoTrack({ id: "t1", elements: [el] });
			const result = getElementsAtTime({ tracks: [track], time: 2 });
			expect(result).toEqual([]);
		});

		test("excludes elements at exact end boundary", () => {
			const el = mockVideoElement({
				id: "vid-1",
				startTime: 2,
				duration: 5,
			});
			const track = mockVideoTrack({ id: "t1", elements: [el] });
			const result = getElementsAtTime({ tracks: [track], time: 7 });
			expect(result).toEqual([]);
		});

		test("returns elements from multiple tracks", () => {
			const vid = mockVideoElement({
				id: "vid-1",
				startTime: 0,
				duration: 10,
			});
			const txt = mockTextElement({
				id: "txt-1",
				startTime: 1,
				duration: 8,
			});
			const vTrack = mockVideoTrack({ id: "tv", elements: [vid] });
			const tTrack = mockTextTrack({ id: "tt", elements: [txt] });
			const result = getElementsAtTime({
				tracks: [vTrack, tTrack],
				time: 5,
			});
			expect(result).toHaveLength(2);
		});
	});

	// ---- collectFontFamilies ----
	describe("collectFontFamilies", () => {
		test("returns empty for tracks with no text elements", () => {
			const track = mockVideoTrack({
				elements: [mockVideoElement()],
			});
			expect(collectFontFamilies({ tracks: [track] })).toEqual([]);
		});

		test("collects unique font families from text elements", () => {
			const txt1 = mockTextElement({ id: "t1", fontFamily: "Arial" });
			const txt2 = mockTextElement({ id: "t2", fontFamily: "Roboto" });
			const txt3 = mockTextElement({ id: "t3", fontFamily: "Arial" });
			const track = mockTextTrack({ elements: [txt1, txt2, txt3] });
			const result = collectFontFamilies({ tracks: [track] });
			expect(result.sort()).toEqual(["Arial", "Roboto"]);
		});

		test("collects from multiple tracks", () => {
			const t1 = mockTextTrack({
				id: "tt1",
				elements: [mockTextElement({ id: "a", fontFamily: "Mono" })],
			});
			const t2 = mockTextTrack({
				id: "tt2",
				elements: [mockTextElement({ id: "b", fontFamily: "Serif" })],
			});
			const result = collectFontFamilies({ tracks: [t1, t2] });
			expect(result.sort()).toEqual(["Mono", "Serif"]);
		});
	});
});

// ===================================================================
// 2. track-utils.ts
// ===================================================================

describe("track-utils", () => {
	// ---- isMainTrack ----
	describe("isMainTrack", () => {
		test("returns true for a video track with isMain true", () => {
			const track = mockMainTrack();
			expect(isMainTrack(track)).toBe(true);
		});

		test("returns false for a video track with isMain false", () => {
			const track = mockVideoTrack({ isMain: false });
			expect(isMainTrack(track)).toBe(false);
		});

		test("returns false for a non-video track", () => {
			const track = mockAudioTrack();
			expect(isMainTrack(track)).toBe(false);
		});
	});

	// ---- canElementGoOnTrack ----
	describe("canElementGoOnTrack", () => {
		test("text goes on text track", () => {
			expect(
				canElementGoOnTrack({ elementType: "text", trackType: "text" }),
			).toBe(true);
		});

		test("text does not go on video track", () => {
			expect(
				canElementGoOnTrack({ elementType: "text", trackType: "video" }),
			).toBe(false);
		});

		test("audio goes on audio track", () => {
			expect(
				canElementGoOnTrack({ elementType: "audio", trackType: "audio" }),
			).toBe(true);
		});

		test("audio does not go on video track", () => {
			expect(
				canElementGoOnTrack({ elementType: "audio", trackType: "video" }),
			).toBe(false);
		});

		test("video goes on video track", () => {
			expect(
				canElementGoOnTrack({ elementType: "video", trackType: "video" }),
			).toBe(true);
		});

		test("image goes on video track", () => {
			expect(
				canElementGoOnTrack({ elementType: "image", trackType: "video" }),
			).toBe(true);
		});

		test("sticker goes on sticker track", () => {
			expect(
				canElementGoOnTrack({
					elementType: "sticker",
					trackType: "sticker",
				}),
			).toBe(true);
		});

		test("sticker does not go on text track", () => {
			expect(
				canElementGoOnTrack({
					elementType: "sticker",
					trackType: "text",
				}),
			).toBe(false);
		});

		test("effect goes on effect track", () => {
			expect(
				canElementGoOnTrack({
					elementType: "effect",
					trackType: "effect",
				}),
			).toBe(true);
		});

		test("effect does not go on audio track", () => {
			expect(
				canElementGoOnTrack({
					elementType: "effect",
					trackType: "audio",
				}),
			).toBe(false);
		});
	});

	// ---- buildEmptyTrack ----
	describe("buildEmptyTrack", () => {
		test("builds video track with correct defaults", () => {
			const track = buildEmptyTrack({ id: "v1", type: "video" });
			expect(track.type).toBe("video");
			expect(track.id).toBe("v1");
			expect(track.elements).toEqual([]);
			expect((track as VideoTrack).isMain).toBe(false);
			expect((track as VideoTrack).muted).toBe(false);
			expect((track as VideoTrack).hidden).toBe(false);
		});

		test("builds audio track with correct defaults", () => {
			const track = buildEmptyTrack({ id: "a1", type: "audio" });
			expect(track.type).toBe("audio");
			expect((track as AudioTrack).muted).toBe(false);
			expect((track as any).hidden).toBeUndefined();
		});

		test("builds text track with correct defaults", () => {
			const track = buildEmptyTrack({ id: "t1", type: "text" });
			expect(track.type).toBe("text");
			expect((track as TextTrack).hidden).toBe(false);
		});

		test("builds sticker track", () => {
			const track = buildEmptyTrack({ id: "s1", type: "sticker" });
			expect(track.type).toBe("sticker");
			expect((track as StickerTrack).hidden).toBe(false);
		});

		test("builds effect track", () => {
			const track = buildEmptyTrack({ id: "e1", type: "effect" });
			expect(track.type).toBe("effect");
			expect((track as EffectTrack).hidden).toBe(false);
		});

		test("uses provided name over default", () => {
			const track = buildEmptyTrack({
				id: "v1",
				type: "video",
				name: "Custom Name",
			});
			expect(track.name).toBe("Custom Name");
		});

		test("uses default name when none provided", () => {
			const track = buildEmptyTrack({ id: "v1", type: "video" });
			expect(track.name).toBe("Video track");
		});
	});

	// ---- getDefaultInsertIndexForTrack ----
	describe("getDefaultInsertIndexForTrack", () => {
		test("audio tracks are inserted at the end", () => {
			const tracks: TimelineTrack[] = [
				mockMainTrack(),
				mockTextTrack(),
			];
			const idx = getDefaultInsertIndexForTrack({
				tracks,
				trackType: "audio",
			});
			expect(idx).toBe(tracks.length);
		});

		test("effect tracks are inserted at index 0", () => {
			const tracks: TimelineTrack[] = [
				mockMainTrack(),
				mockAudioTrack(),
			];
			const idx = getDefaultInsertIndexForTrack({
				tracks,
				trackType: "effect",
			});
			expect(idx).toBe(0);
		});

		test("visual tracks are inserted above main track", () => {
			const main = mockMainTrack();
			const tracks: TimelineTrack[] = [
				mockTextTrack(),
				main,
				mockAudioTrack(),
			];
			const idx = getDefaultInsertIndexForTrack({
				tracks,
				trackType: "video",
			});
			// main track is at index 1
			expect(idx).toBe(1);
		});

		test("when no main track, visual track goes before first audio", () => {
			const tracks: TimelineTrack[] = [
				mockTextTrack(),
				mockAudioTrack({ id: "a1" }),
			];
			const idx = getDefaultInsertIndexForTrack({
				tracks,
				trackType: "video",
			});
			expect(idx).toBe(1);
		});

		test("when no main track and no audio, visual track goes at end", () => {
			const tracks: TimelineTrack[] = [mockTextTrack()];
			const idx = getDefaultInsertIndexForTrack({
				tracks,
				trackType: "text",
			});
			expect(idx).toBe(tracks.length);
		});
	});

	// ---- validateElementTrackCompatibility ----
	describe("validateElementTrackCompatibility", () => {
		test("valid: video element on video track", () => {
			const result = validateElementTrackCompatibility({
				element: { type: "video" },
				track: { type: "video" },
			});
			expect(result.isValid).toBe(true);
			expect(result.errorMessage).toBeUndefined();
		});

		test("invalid: audio element on video track", () => {
			const result = validateElementTrackCompatibility({
				element: { type: "audio" },
				track: { type: "video" },
			});
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain("audio");
			expect(result.errorMessage).toContain("video");
		});

		test("valid: text element on text track", () => {
			const result = validateElementTrackCompatibility({
				element: { type: "text" },
				track: { type: "text" },
			});
			expect(result.isValid).toBe(true);
		});
	});

	// ---- enforceMainTrackStart ----
	describe("enforceMainTrackStart", () => {
		test("returns requested time when target is not main track", () => {
			const tracks: TimelineTrack[] = [
				mockMainTrack({ id: "main" }),
				mockVideoTrack({ id: "other" }),
			];
			const result = enforceMainTrackStart({
				tracks,
				targetTrackId: "other",
				requestedStartTime: 5,
			});
			expect(result).toBe(5);
		});

		test("returns 0 when main track has no existing elements", () => {
			const tracks: TimelineTrack[] = [mockMainTrack({ id: "main" })];
			const result = enforceMainTrackStart({
				tracks,
				targetTrackId: "main",
				requestedStartTime: 5,
			});
			expect(result).toBe(0);
		});

		test("pins to 0 when element would become earliest on main track", () => {
			const existingEl = mockVideoElement({
				id: "e1",
				startTime: 3,
				duration: 5,
			});
			const tracks: TimelineTrack[] = [
				mockMainTrack({ id: "main", elements: [existingEl] }),
			];
			const result = enforceMainTrackStart({
				tracks,
				targetTrackId: "main",
				requestedStartTime: 1,
			});
			expect(result).toBe(0);
		});

		test("allows requested time when after earliest element", () => {
			const existingEl = mockVideoElement({
				id: "e1",
				startTime: 0,
				duration: 5,
			});
			const tracks: TimelineTrack[] = [
				mockMainTrack({ id: "main", elements: [existingEl] }),
			];
			const result = enforceMainTrackStart({
				tracks,
				targetTrackId: "main",
				requestedStartTime: 8,
			});
			expect(result).toBe(8);
		});

		test("excludes element by id when finding earliest", () => {
			const el1 = mockVideoElement({
				id: "e1",
				startTime: 0,
				duration: 5,
			});
			const el2 = mockVideoElement({
				id: "e2",
				startTime: 10,
				duration: 5,
			});
			const tracks: TimelineTrack[] = [
				mockMainTrack({ id: "main", elements: [el1, el2] }),
			];
			// Excluding e1 makes e2 the earliest (startTime=10).
			// requestedStartTime=5 < 10, so it's pinned to 0.
			const result = enforceMainTrackStart({
				tracks,
				targetTrackId: "main",
				requestedStartTime: 5,
				excludeElementId: "e1",
			});
			expect(result).toBe(0);
		});
	});
});

// ===================================================================
// 3. snap-utils.ts
// ===================================================================

describe("snap-utils", () => {
	// ---- findSnapPoints ----
	describe("findSnapPoints", () => {
		test("returns playhead snap point by default", () => {
			const result = findSnapPoints({ tracks: [], playheadTime: 5 });
			expect(result).toContainEqual({ time: 5, type: "playhead" });
		});

		test("returns element start and end snap points", () => {
			const el = mockVideoElement({
				id: "v1",
				startTime: 2,
				duration: 3,
			});
			const track = mockVideoTrack({ id: "t1", elements: [el] });
			const result = findSnapPoints({
				tracks: [track],
				playheadTime: 0,
			});
			const elementPoints = result.filter(
				(p) => p.type === "element-start" || p.type === "element-end",
			);
			expect(elementPoints).toContainEqual(
				expect.objectContaining({ time: 2, type: "element-start" }),
			);
			expect(elementPoints).toContainEqual(
				expect.objectContaining({ time: 5, type: "element-end" }),
			);
		});

		test("excludes element by id", () => {
			const el = mockVideoElement({
				id: "v1",
				startTime: 2,
				duration: 3,
			});
			const track = mockVideoTrack({ id: "t1", elements: [el] });
			const result = findSnapPoints({
				tracks: [track],
				playheadTime: 0,
				excludeElementId: "v1",
			});
			const elementPoints = result.filter(
				(p) => p.type === "element-start" || p.type === "element-end",
			);
			expect(elementPoints).toHaveLength(0);
		});

		test("includes bookmark snap points", () => {
			const bookmarks: Bookmark[] = [{ time: 3.5 }, { time: 7 }];
			const result = findSnapPoints({
				tracks: [],
				playheadTime: 0,
				bookmarks,
			});
			const bookmarkPoints = result.filter((p) => p.type === "bookmark");
			expect(bookmarkPoints).toHaveLength(2);
			expect(bookmarkPoints[0].time).toBe(3.5);
			expect(bookmarkPoints[1].time).toBe(7);
		});

		test("excludes bookmark at specified time", () => {
			const bookmarks: Bookmark[] = [{ time: 3.5 }, { time: 7 }];
			const result = findSnapPoints({
				tracks: [],
				playheadTime: 0,
				bookmarks,
				excludeBookmarkTime: 3.5,
			});
			const bookmarkPoints = result.filter((p) => p.type === "bookmark");
			expect(bookmarkPoints).toHaveLength(1);
			expect(bookmarkPoints[0].time).toBe(7);
		});

		test("disabling element snapping excludes element points", () => {
			const el = mockVideoElement({
				id: "v1",
				startTime: 2,
				duration: 3,
			});
			const track = mockVideoTrack({ id: "t1", elements: [el] });
			const result = findSnapPoints({
				tracks: [track],
				playheadTime: 0,
				enableElementSnapping: false,
			});
			const elementPoints = result.filter(
				(p) => p.type === "element-start" || p.type === "element-end",
			);
			expect(elementPoints).toHaveLength(0);
		});

		test("disabling playhead snapping excludes playhead point", () => {
			const result = findSnapPoints({
				tracks: [],
				playheadTime: 5,
				enablePlayheadSnapping: false,
			});
			const playheadPoints = result.filter((p) => p.type === "playhead");
			expect(playheadPoints).toHaveLength(0);
		});
	});

	// ---- snapToNearestPoint ----
	describe("snapToNearestPoint", () => {
		const pps = TIMELINE_CONSTANTS.PIXELS_PER_SECOND;

		test("snaps to the nearest point within threshold", () => {
			const snapPoints = [{ time: 5, type: "playhead" as const }];
			// zoomLevel=1 => pixelsPerSecond=50. threshold=10px => 0.2s
			const result = snapToNearestPoint({
				targetTime: 5.1,
				snapPoints,
				zoomLevel: 1,
			});
			expect(result.snappedTime).toBe(5);
			expect(result.snapPoint).toEqual({ time: 5, type: "playhead" });
		});

		test("returns targetTime when no point is within threshold", () => {
			const snapPoints = [{ time: 100, type: "playhead" as const }];
			const result = snapToNearestPoint({
				targetTime: 5,
				snapPoints,
				zoomLevel: 1,
			});
			expect(result.snappedTime).toBe(5);
			expect(result.snapPoint).toBeNull();
		});

		test("snaps to the closest point among multiple candidates", () => {
			const snapPoints = [
				{ time: 3, type: "element-start" as const },
				{ time: 5.05, type: "playhead" as const },
			];
			const result = snapToNearestPoint({
				targetTime: 5,
				snapPoints,
				zoomLevel: 1,
			});
			expect(result.snappedTime).toBe(5.05);
		});

		test("higher zoom level narrows the snap threshold in seconds", () => {
			const snapPoints = [{ time: 5, type: "playhead" as const }];
			// zoomLevel=10 => pps=500, threshold=10px => 0.02s
			const result = snapToNearestPoint({
				targetTime: 5.05,
				snapPoints,
				zoomLevel: 10,
			});
			// 0.05s > 0.02s so should NOT snap
			expect(result.snappedTime).toBe(5.05);
			expect(result.snapPoint).toBeNull();
		});
	});

	// ---- snapElementEdge ----
	describe("snapElementEdge", () => {
		test("snaps start edge to nearest point", () => {
			const el = mockVideoElement({
				id: "v1",
				startTime: 5,
				duration: 3,
			});
			const track = mockVideoTrack({ id: "t1", elements: [el] });
			const result = snapElementEdge({
				targetTime: 4.95,
				elementDuration: 2,
				tracks: [track],
				playheadTime: 0,
				zoomLevel: 1,
				snapToStart: true,
			});
			// element-start at 5 is within threshold
			expect(result.snappedTime).toBe(5);
		});

		test("snaps end edge to nearest point", () => {
			const el = mockVideoElement({
				id: "v1",
				startTime: 5,
				duration: 3,
			});
			const track = mockVideoTrack({ id: "t1", elements: [el] });
			// When snapToStart=false, we snap the end of the element (targetTime + elementDuration)
			// targetTime=2.9, elementDuration=2 => end = 4.9, and element starts at 5
			const result = snapElementEdge({
				targetTime: 2.9,
				elementDuration: 2,
				tracks: [track],
				playheadTime: 0,
				zoomLevel: 1,
				snapToStart: false,
			});
			// end should snap to 5 (element start), so snappedTime = 5 - 2 = 3
			expect(result.snappedTime).toBe(3);
		});

		test("returns original time when nothing is within snap range", () => {
			const result = snapElementEdge({
				targetTime: 50,
				elementDuration: 2,
				tracks: [],
				playheadTime: 100,
				zoomLevel: 1,
				snapToStart: true,
			});
			// only playhead at 100 is a snap point, which is far away
			expect(result.snappedTime).toBe(50);
		});
	});
});

// ===================================================================
// 4. pixel-utils.ts
// ===================================================================

describe("pixel-utils", () => {
	// ---- getTimelinePixelsPerSecond ----
	describe("getTimelinePixelsPerSecond", () => {
		test("returns base value at zoom 1", () => {
			expect(getTimelinePixelsPerSecond({ zoomLevel: 1 })).toBe(
				TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
			);
		});

		test("scales linearly with zoom level", () => {
			expect(getTimelinePixelsPerSecond({ zoomLevel: 2 })).toBe(
				TIMELINE_CONSTANTS.PIXELS_PER_SECOND * 2,
			);
		});

		test("handles fractional zoom levels", () => {
			expect(getTimelinePixelsPerSecond({ zoomLevel: 0.5 })).toBe(
				TIMELINE_CONSTANTS.PIXELS_PER_SECOND * 0.5,
			);
		});
	});

	// ---- timelineTimeToPixels ----
	describe("timelineTimeToPixels", () => {
		test("converts time at zoom 1", () => {
			// 1 second at zoom 1 = 50px (PIXELS_PER_SECOND)
			expect(timelineTimeToPixels({ time: 1, zoomLevel: 1 })).toBe(
				TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
			);
		});

		test("converts time at zoom 2", () => {
			expect(timelineTimeToPixels({ time: 1, zoomLevel: 2 })).toBe(
				TIMELINE_CONSTANTS.PIXELS_PER_SECOND * 2,
			);
		});

		test("returns 0 for time 0", () => {
			expect(timelineTimeToPixels({ time: 0, zoomLevel: 1 })).toBe(0);
		});

		test("handles large time values", () => {
			expect(timelineTimeToPixels({ time: 60, zoomLevel: 1 })).toBe(
				60 * TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
			);
		});

		test("handles fractional time values", () => {
			const result = timelineTimeToPixels({ time: 0.5, zoomLevel: 1 });
			expect(result).toBe(TIMELINE_CONSTANTS.PIXELS_PER_SECOND * 0.5);
		});
	});
});

// ===================================================================
// 5. ruler-utils.ts
// ===================================================================

describe("ruler-utils", () => {
	// ---- getRulerConfig ----
	describe("getRulerConfig", () => {
		test("returns valid label and tick intervals at zoom 1, 30fps", () => {
			const config = getRulerConfig({ zoomLevel: 1, fps: 30 });
			expect(config.labelIntervalSeconds).toBeGreaterThan(0);
			expect(config.tickIntervalSeconds).toBeGreaterThan(0);
		});

		test("tick interval is <= label interval", () => {
			const config = getRulerConfig({ zoomLevel: 1, fps: 30 });
			expect(config.tickIntervalSeconds).toBeLessThanOrEqual(
				config.labelIntervalSeconds,
			);
		});

		test("higher zoom produces smaller intervals", () => {
			const lowZoom = getRulerConfig({ zoomLevel: 0.5, fps: 30 });
			const highZoom = getRulerConfig({ zoomLevel: 10, fps: 30 });
			expect(highZoom.labelIntervalSeconds).toBeLessThanOrEqual(
				lowZoom.labelIntervalSeconds,
			);
		});

		test("tick interval divides evenly into label interval", () => {
			const config = getRulerConfig({ zoomLevel: 5, fps: 24 });
			const labelFrames = Math.round(
				config.labelIntervalSeconds * 24,
			);
			const tickFrames = Math.round(
				config.tickIntervalSeconds * 24,
			);
			expect(labelFrames % tickFrames).toBe(0);
		});

		test("works with high fps (60)", () => {
			const config = getRulerConfig({ zoomLevel: 1, fps: 60 });
			expect(config.labelIntervalSeconds).toBeGreaterThan(0);
			expect(config.tickIntervalSeconds).toBeGreaterThan(0);
		});
	});

	// ---- shouldShowLabel ----
	describe("shouldShowLabel", () => {
		test("returns true at exact interval boundaries", () => {
			expect(
				shouldShowLabel({ time: 0, labelIntervalSeconds: 1 }),
			).toBe(true);
			expect(
				shouldShowLabel({ time: 1, labelIntervalSeconds: 1 }),
			).toBe(true);
			expect(
				shouldShowLabel({ time: 2, labelIntervalSeconds: 1 }),
			).toBe(true);
		});

		test("returns false between intervals", () => {
			expect(
				shouldShowLabel({ time: 0.5, labelIntervalSeconds: 1 }),
			).toBe(false);
		});

		test("handles fractional intervals", () => {
			expect(
				shouldShowLabel({ time: 0.5, labelIntervalSeconds: 0.5 }),
			).toBe(true);
			expect(
				shouldShowLabel({ time: 1.0, labelIntervalSeconds: 0.5 }),
			).toBe(true);
		});

		test("handles near-boundary times with epsilon tolerance", () => {
			// Just below the boundary
			expect(
				shouldShowLabel({ time: 0.99999, labelIntervalSeconds: 1 }),
			).toBe(true);
		});
	});

	// ---- formatRulerLabel ----
	describe("formatRulerLabel", () => {
		test("formats second boundaries as MM:SS", () => {
			expect(formatRulerLabel({ timeInSeconds: 0, fps: 30 })).toBe(
				"00:00",
			);
		});

		test("formats 90 seconds as 01:30", () => {
			expect(formatRulerLabel({ timeInSeconds: 90, fps: 30 })).toBe(
				"01:30",
			);
		});

		test("formats hour+ times as H:MM:SS", () => {
			expect(formatRulerLabel({ timeInSeconds: 3661, fps: 30 })).toBe(
				"1:01:01",
			);
		});

		test("formats fractional seconds as frame number", () => {
			// 0.5s at 30fps = frame 15
			expect(formatRulerLabel({ timeInSeconds: 0.5, fps: 30 })).toBe(
				"15f",
			);
		});

		test("formats frame label at 24fps", () => {
			// 0.5s at 24fps = frame 12
			expect(formatRulerLabel({ timeInSeconds: 0.5, fps: 24 })).toBe(
				"12f",
			);
		});

		test("formats first frame within a second", () => {
			// 1/30 second at 30fps = frame 1
			const t = 1 / 30;
			expect(formatRulerLabel({ timeInSeconds: t, fps: 30 })).toBe(
				"1f",
			);
		});
	});
});

// ===================================================================
// 6. zoom-utils.ts
// ===================================================================

describe("zoom-utils", () => {
	// ---- getTimelineZoomMin ----
	describe("getTimelineZoomMin", () => {
		test("returns a positive zoom level", () => {
			const min = getTimelineZoomMin({
				duration: 60,
				containerWidth: 1000,
			});
			expect(min).toBeGreaterThan(0);
		});

		test("shorter durations produce higher min zoom", () => {
			const short = getTimelineZoomMin({
				duration: 5,
				containerWidth: 1000,
			});
			const long = getTimelineZoomMin({
				duration: 300,
				containerWidth: 1000,
			});
			expect(short).toBeGreaterThan(long);
		});

		test("wider containers produce higher min zoom (fit more content)", () => {
			const narrow = getTimelineZoomMin({
				duration: 60,
				containerWidth: 500,
			});
			const wide = getTimelineZoomMin({
				duration: 60,
				containerWidth: 2000,
			});
			expect(wide).toBeGreaterThan(narrow);
		});

		test("handles null containerWidth with fallback", () => {
			const result = getTimelineZoomMin({
				duration: 10,
				containerWidth: null,
			});
			expect(result).toBeGreaterThan(0);
		});

		test("handles zero duration by clamping to 1", () => {
			const result = getTimelineZoomMin({
				duration: 0,
				containerWidth: 1000,
			});
			expect(result).toBeGreaterThan(0);
			expect(Number.isFinite(result)).toBe(true);
		});

		test("does not exceed ZOOM_MAX", () => {
			const result = getTimelineZoomMin({
				duration: 0.001,
				containerWidth: 10000,
			});
			expect(result).toBeLessThanOrEqual(TIMELINE_CONSTANTS.ZOOM_MAX);
		});
	});

	// ---- sliderToZoom ----
	describe("sliderToZoom", () => {
		test("slider 0 returns minZoom", () => {
			expect(sliderToZoom({ sliderPosition: 0, minZoom: 0.5 })).toBe(
				0.5,
			);
		});

		test("slider 1 returns maxZoom", () => {
			const result = sliderToZoom({ sliderPosition: 1, minZoom: 0.5 });
			expect(result).toBeCloseTo(TIMELINE_CONSTANTS.ZOOM_MAX, 5);
		});

		test("slider 0.5 returns geometric midpoint", () => {
			const minZoom = 1;
			const maxZoom = TIMELINE_CONSTANTS.ZOOM_MAX;
			const result = sliderToZoom({ sliderPosition: 0.5, minZoom });
			const expected = Math.sqrt(minZoom * maxZoom);
			expect(result).toBeCloseTo(expected, 5);
		});

		test("clamps slider position below 0", () => {
			const result = sliderToZoom({
				sliderPosition: -0.5,
				minZoom: 1,
			});
			expect(result).toBe(1);
		});

		test("clamps slider position above 1", () => {
			const result = sliderToZoom({
				sliderPosition: 1.5,
				minZoom: 1,
			});
			expect(result).toBeCloseTo(TIMELINE_CONSTANTS.ZOOM_MAX, 5);
		});

		test("respects custom maxZoom", () => {
			const result = sliderToZoom({
				sliderPosition: 1,
				minZoom: 1,
				maxZoom: 50,
			});
			expect(result).toBeCloseTo(50, 5);
		});
	});

	// ---- zoomToSlider ----
	describe("zoomToSlider", () => {
		test("minZoom maps to slider 0", () => {
			expect(zoomToSlider({ zoomLevel: 0.5, minZoom: 0.5 })).toBeCloseTo(
				0,
				5,
			);
		});

		test("maxZoom maps to slider 1", () => {
			expect(
				zoomToSlider({
					zoomLevel: TIMELINE_CONSTANTS.ZOOM_MAX,
					minZoom: 0.5,
				}),
			).toBeCloseTo(1, 5);
		});

		test("round-trips with sliderToZoom", () => {
			const minZoom = 0.3;
			const sliderPos = 0.7;
			const zoom = sliderToZoom({ sliderPosition: sliderPos, minZoom });
			const roundTrip = zoomToSlider({ zoomLevel: zoom, minZoom });
			expect(roundTrip).toBeCloseTo(sliderPos, 5);
		});

		test("clamps zoom below minZoom to 0", () => {
			const result = zoomToSlider({ zoomLevel: 0.1, minZoom: 1 });
			expect(result).toBeCloseTo(0, 5);
		});

		test("clamps zoom above maxZoom to 1", () => {
			const result = zoomToSlider({ zoomLevel: 999, minZoom: 1 });
			expect(result).toBeCloseTo(1, 5);
		});
	});
});

// ===================================================================
// 7. bookmarks.ts
// ===================================================================

describe("bookmarks", () => {
	const sampleBookmarks: Bookmark[] = [
		{ time: 1.0 },
		{ time: 3.5 },
		{ time: 7.0 },
	];

	// ---- findBookmarkIndex ----
	describe("findBookmarkIndex", () => {
		test("returns index of bookmark at exact time", () => {
			expect(
				findBookmarkIndex({
					bookmarks: sampleBookmarks,
					frameTime: 3.5,
				}),
			).toBe(1);
		});

		test("returns -1 when no bookmark at time", () => {
			expect(
				findBookmarkIndex({
					bookmarks: sampleBookmarks,
					frameTime: 5.0,
				}),
			).toBe(-1);
		});

		test("matches within epsilon tolerance", () => {
			expect(
				findBookmarkIndex({
					bookmarks: sampleBookmarks,
					frameTime: 1.0005,
				}),
			).toBe(0);
		});

		test("does not match beyond epsilon", () => {
			expect(
				findBookmarkIndex({
					bookmarks: sampleBookmarks,
					frameTime: 1.002,
				}),
			).toBe(-1);
		});

		test("returns -1 for empty bookmarks array", () => {
			expect(
				findBookmarkIndex({ bookmarks: [], frameTime: 1 }),
			).toBe(-1);
		});
	});

	// ---- isBookmarkAtTime ----
	describe("isBookmarkAtTime", () => {
		test("returns true when bookmark exists at time", () => {
			expect(
				isBookmarkAtTime({
					bookmarks: sampleBookmarks,
					frameTime: 7.0,
				}),
			).toBe(true);
		});

		test("returns false when no bookmark at time", () => {
			expect(
				isBookmarkAtTime({
					bookmarks: sampleBookmarks,
					frameTime: 2.0,
				}),
			).toBe(false);
		});

		test("returns false for empty bookmarks", () => {
			expect(
				isBookmarkAtTime({ bookmarks: [], frameTime: 0 }),
			).toBe(false);
		});

		test("matches within epsilon", () => {
			expect(
				isBookmarkAtTime({
					bookmarks: sampleBookmarks,
					frameTime: 3.5004,
				}),
			).toBe(true);
		});
	});
});

// ===================================================================
// 8. ripple-utils.ts
// ===================================================================

describe("ripple-utils", () => {
	describe("rippleShiftElements", () => {
		test("shifts elements at or after afterTime by shiftAmount", () => {
			const elements: TimelineElement[] = [
				mockVideoElement({ id: "a", startTime: 0, duration: 3 }),
				mockVideoElement({ id: "b", startTime: 5, duration: 3 }),
				mockVideoElement({ id: "c", startTime: 10, duration: 3 }),
			];
			const result = rippleShiftElements({
				elements,
				afterTime: 5,
				shiftAmount: 2,
			});
			expect(result[0].startTime).toBe(0); // before afterTime, unchanged
			expect(result[1].startTime).toBe(3); // at afterTime, shifted by -2
			expect(result[2].startTime).toBe(8); // after afterTime, shifted by -2
		});

		test("does not shift elements before afterTime", () => {
			const elements: TimelineElement[] = [
				mockVideoElement({ id: "a", startTime: 0, duration: 3 }),
				mockVideoElement({ id: "b", startTime: 2, duration: 1 }),
			];
			const result = rippleShiftElements({
				elements,
				afterTime: 5,
				shiftAmount: 2,
			});
			expect(result[0].startTime).toBe(0);
			expect(result[1].startTime).toBe(2);
		});

		test("handles zero shiftAmount (no change)", () => {
			const elements: TimelineElement[] = [
				mockVideoElement({ id: "a", startTime: 5, duration: 3 }),
			];
			const result = rippleShiftElements({
				elements,
				afterTime: 0,
				shiftAmount: 0,
			});
			expect(result[0].startTime).toBe(5);
		});

		test("handles negative shiftAmount (shifts forward)", () => {
			const elements: TimelineElement[] = [
				mockVideoElement({ id: "a", startTime: 5, duration: 3 }),
			];
			const result = rippleShiftElements({
				elements,
				afterTime: 0,
				shiftAmount: -2,
			});
			// startTime - (-2) = 5 + 2 = 7
			expect(result[0].startTime).toBe(7);
		});

		test("does not mutate original elements", () => {
			const original = mockVideoElement({
				id: "a",
				startTime: 5,
				duration: 3,
			});
			const elements: TimelineElement[] = [original];
			rippleShiftElements({
				elements,
				afterTime: 0,
				shiftAmount: 2,
			});
			expect(original.startTime).toBe(5);
		});

		test("returns empty array for empty input", () => {
			const result = rippleShiftElements({
				elements: [],
				afterTime: 0,
				shiftAmount: 1,
			});
			expect(result).toEqual([]);
		});

		test("shifts element exactly at afterTime boundary", () => {
			const elements: TimelineElement[] = [
				mockVideoElement({ id: "a", startTime: 5, duration: 3 }),
			];
			const result = rippleShiftElements({
				elements,
				afterTime: 5,
				shiftAmount: 1,
			});
			expect(result[0].startTime).toBe(4);
		});
	});
});
