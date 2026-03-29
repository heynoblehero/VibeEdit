export interface FaceLandmarks {
	landmarks: Array<{ x: number; y: number; z: number }>;
	/** Derived regions for beauty filters */
	jawLine: Array<{ x: number; y: number }>;
	leftCheek: { x: number; y: number };
	rightCheek: { x: number; y: number };
	leftEye: {
		center: { x: number; y: number };
		width: number;
		height: number;
	};
	rightEye: {
		center: { x: number; y: number };
		width: number;
		height: number;
	};
	skinRegion: { points: Array<{ x: number; y: number }> };
}

// MediaPipe face mesh landmark indices
// Jaw outer contour
const JAW_INDICES = [
	10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
	378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
	162, 21, 54, 103, 67, 109,
];

// Left eye contour
const LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 144, 145, 153];

// Right eye contour
const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 373, 374, 380];

// Key landmark indices
const LEFT_CHEEK_INDEX = 205;
const RIGHT_CHEEK_INDEX = 425;
const NOSE_TIP_INDEX = 1;
const FOREHEAD_INDEX = 10;
const CHIN_INDEX = 152;

// Skin region: forehead, temples, cheeks, jaw — convex hull of face
const SKIN_REGION_INDICES = [
	10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
	378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
	162, 21, 54, 103, 67, 109,
];

function computeCenter(
	points: Array<{ x: number; y: number }>,
): { x: number; y: number } {
	let sx = 0;
	let sy = 0;
	for (const p of points) {
		sx += p.x;
		sy += p.y;
	}
	return { x: sx / points.length, y: sy / points.length };
}

function computeBounds(points: Array<{ x: number; y: number }>): {
	center: { x: number; y: number };
	width: number;
	height: number;
} {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		if (p.x < minX) minX = p.x;
		if (p.x > maxX) maxX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.y > maxY) maxY = p.y;
	}
	return {
		center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
		width: maxX - minX,
		height: maxY - minY,
	};
}

/**
 * Extracts derived face regions from the raw 468 MediaPipe face mesh landmarks.
 *
 * MediaPipe face mesh indices used:
 * - Jaw: outer contour (indices around the face oval)
 * - Left eye: 33, 133, 160, 159, 158, 144, 145, 153
 * - Right eye: 362, 263, 387, 386, 385, 373, 374, 380
 * - Left cheek center: ~index 205
 * - Right cheek center: ~index 425
 * - Nose tip: index 1
 * - Forehead: index 10
 * - Chin: index 152
 */
export function extractFaceRegions(
	rawLandmarks: Array<{ x: number; y: number; z: number }>,
): FaceLandmarks {
	const pick = (indices: number[]) =>
		indices
			.filter((i) => i < rawLandmarks.length)
			.map((i) => ({ x: rawLandmarks[i].x, y: rawLandmarks[i].y }));

	const jawLine = pick(JAW_INDICES);

	const leftEyePoints = pick(LEFT_EYE_INDICES);
	const rightEyePoints = pick(RIGHT_EYE_INDICES);

	const leftEye = computeBounds(leftEyePoints);
	const rightEye = computeBounds(rightEyePoints);

	const leftCheek =
		LEFT_CHEEK_INDEX < rawLandmarks.length
			? {
					x: rawLandmarks[LEFT_CHEEK_INDEX].x,
					y: rawLandmarks[LEFT_CHEEK_INDEX].y,
				}
			: computeCenter(leftEyePoints);

	const rightCheek =
		RIGHT_CHEEK_INDEX < rawLandmarks.length
			? {
					x: rawLandmarks[RIGHT_CHEEK_INDEX].x,
					y: rawLandmarks[RIGHT_CHEEK_INDEX].y,
				}
			: computeCenter(rightEyePoints);

	const skinRegion = { points: pick(SKIN_REGION_INDICES) };

	return {
		landmarks: rawLandmarks.map((l) => ({ x: l.x, y: l.y, z: l.z })),
		jawLine,
		leftCheek,
		rightCheek,
		leftEye,
		rightEye,
		skinRegion,
	};
}
