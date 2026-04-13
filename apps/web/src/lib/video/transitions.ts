/**
 * Transition effect definitions for video editing.
 * Each transition generates Remotion-compatible React component code.
 */

export interface TransitionDefinition {
	id: string;
	name: string;
	category: "fade" | "wipe" | "slide" | "zoom";
	generateCode: (duration: number) => string;
}

export const TRANSITIONS: TransitionDefinition[] = [
	{
		id: "cross-dissolve",
		name: "Cross Dissolve",
		category: "fade",
		generateCode: (duration) => `({ frame, fps }) => {
			const progress = Math.min(frame / (${duration} * fps), 1);
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'black', opacity: 1 - progress }
			});
		}`,
	},
	{
		id: "fade-black",
		name: "Fade Through Black",
		category: "fade",
		generateCode: (duration) => `({ frame, fps }) => {
			const mid = ${duration} * fps / 2;
			const opacity = frame < mid ? frame / mid : 1 - (frame - mid) / mid;
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'black', opacity }
			});
		}`,
	},
	{
		id: "fade-white",
		name: "Fade Through White",
		category: "fade",
		generateCode: (duration) => `({ frame, fps }) => {
			const mid = ${duration} * fps / 2;
			const opacity = frame < mid ? frame / mid : 1 - (frame - mid) / mid;
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'white', opacity }
			});
		}`,
	},
	{
		id: "wipe-left",
		name: "Wipe Left",
		category: "wipe",
		generateCode: (duration) => `({ frame, fps }) => {
			const progress = Math.min(frame / (${duration} * fps), 1);
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'black', clipPath: 'inset(0 ' + ((1 - progress) * 100) + '% 0 0)' }
			});
		}`,
	},
	{
		id: "wipe-right",
		name: "Wipe Right",
		category: "wipe",
		generateCode: (duration) => `({ frame, fps }) => {
			const progress = Math.min(frame / (${duration} * fps), 1);
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'black', clipPath: 'inset(0 0 0 ' + (progress * 100) + '%)' }
			});
		}`,
	},
	{
		id: "slide-left",
		name: "Slide Left",
		category: "slide",
		generateCode: (duration) => `({ frame, fps, width }) => {
			const progress = Math.min(frame / (${duration} * fps), 1);
			const x = interpolate(progress, [0, 1], [0, -width]);
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'black', transform: 'translateX(' + x + 'px)' }
			});
		}`,
	},
	{
		id: "slide-right",
		name: "Slide Right",
		category: "slide",
		generateCode: (duration) => `({ frame, fps, width }) => {
			const progress = Math.min(frame / (${duration} * fps), 1);
			const x = interpolate(progress, [0, 1], [0, width]);
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'black', transform: 'translateX(' + x + 'px)' }
			});
		}`,
	},
	{
		id: "zoom-in",
		name: "Zoom In",
		category: "zoom",
		generateCode: (duration) => `({ frame, fps }) => {
			const progress = Math.min(frame / (${duration} * fps), 1);
			const scale = 1 + progress * 2;
			const opacity = 1 - progress;
			return React.createElement('div', {
				style: { position: 'absolute', inset: 0, backgroundColor: 'black', opacity, transform: 'scale(' + scale + ')' }
			});
		}`,
	},
];

export function getTransition(id: string): TransitionDefinition | undefined {
	return TRANSITIONS.find((t) => t.id === id);
}

export function getAllTransitions(): TransitionDefinition[] {
	return TRANSITIONS;
}
