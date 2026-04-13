/**
 * Project templates — pre-built edit plans for common video types.
 * Each template generates a plan that the AI can execute.
 */

export interface ProjectTemplate {
	id: string;
	name: string;
	description: string;
	category: "social" | "content" | "business" | "creative";
	icon: string;
	aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
	estimatedDuration: number;
	prompt: string; // AI prompt to generate the plan
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
	{
		id: "youtube-video",
		name: "YouTube Video",
		description: "Full video with intro, content, captions, music, and outro",
		category: "content",
		icon: "play-circle",
		aspectRatio: "16:9",
		estimatedDuration: 600,
		prompt: "Create a plan for a complete YouTube video. Include steps for: 1) An animated intro title (5 seconds), 2) Arranging the uploaded video clips on the timeline with transitions between them, 3) Adding auto-generated captions, 4) Adding background music with ducking during speech, 5) An outro with subscribe button animation. Use the media assets the user has uploaded.",
	},
	{
		id: "tiktok",
		name: "TikTok / Reel",
		description: "Vertical short-form video with captions and music",
		category: "social",
		icon: "smartphone",
		aspectRatio: "9:16",
		estimatedDuration: 60,
		prompt: "Create a plan for a TikTok/Reel video (9:16 vertical, max 60 seconds). Include steps for: 1) Smart reframe the footage to 9:16 vertical, 2) Auto jump cut to remove dead air, 3) Add bold modern-style captions, 4) Add trending background music with ducking. Keep it fast-paced and punchy.",
	},
	{
		id: "podcast-clip",
		name: "Podcast Clip",
		description: "Extract highlights from podcast recording with captions",
		category: "content",
		icon: "headphones",
		aspectRatio: "16:9",
		estimatedDuration: 120,
		prompt: "Create a plan for a podcast highlight clip. Include steps for: 1) Trim the recording to the best 2-minute segment, 2) Add a gradient background behind the audio waveform, 3) Add large, readable captions for social sharing, 4) Add the podcast title as a lower third, 5) Add subtle background music at low volume.",
	},
	{
		id: "product-demo",
		name: "Product Demo",
		description: "Professional product walkthrough with callouts",
		category: "business",
		icon: "package",
		aspectRatio: "16:9",
		estimatedDuration: 180,
		prompt: "Create a plan for a product demo video. Include steps for: 1) Clean intro title with product name (cinematic style), 2) Arrange the screen recording/demo clips in order, 3) Add callout annotations pointing to key features, 4) Add smooth transitions between sections, 5) Add professional background music, 6) Outro with CTA text.",
	},
	{
		id: "tutorial",
		name: "Tutorial / How-To",
		description: "Step-by-step tutorial with numbered sections",
		category: "content",
		icon: "graduation-cap",
		aspectRatio: "16:9",
		estimatedDuration: 300,
		prompt: "Create a plan for a tutorial video. Include steps for: 1) Title card intro with tutorial name, 2) Add step number title cards between sections (Step 1, Step 2, etc.), 3) Arrange tutorial clips in order, 4) Add captions for accessibility, 5) Add callout annotations on key moments, 6) Summary/recap section at the end.",
	},
	{
		id: "instagram-post",
		name: "Instagram Post Video",
		description: "Square video optimized for Instagram feed",
		category: "social",
		icon: "image",
		aspectRatio: "1:1",
		estimatedDuration: 30,
		prompt: "Create a plan for an Instagram feed video (1:1 square, max 30 seconds). Include steps for: 1) Smart reframe to 1:1 square, 2) Add eye-catching animated title in the first 2 seconds, 3) Quick cuts with transitions, 4) Add bold text overlays, 5) No captions needed but add background music.",
	},
	{
		id: "highlight-reel",
		name: "Highlight Reel",
		description: "Best moments compilation with dynamic editing",
		category: "creative",
		icon: "zap",
		aspectRatio: "16:9",
		estimatedDuration: 120,
		prompt: "Create a plan for a highlight reel / montage. Include steps for: 1) Select the best moments from uploaded clips (high energy parts), 2) Arrange with fast-paced cuts (2-5 second clips), 3) Add beat-synced transitions, 4) Add energetic background music, 5) Opening title card, 6) Closing fade out.",
	},
	{
		id: "slideshow",
		name: "Photo Slideshow",
		description: "Beautiful slideshow from photos with Ken Burns effect",
		category: "creative",
		icon: "images",
		aspectRatio: "16:9",
		estimatedDuration: 120,
		prompt: "Create a plan for a photo slideshow. Include steps for: 1) Arrange all uploaded images on the timeline (5 seconds each), 2) Apply Ken Burns slow zoom effect to each photo, 3) Add cross-dissolve transitions between photos, 4) Add soft background music, 5) Optional: add a title at the start and end.",
	},
];

export function getTemplate(id: string): ProjectTemplate | undefined {
	return PROJECT_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): ProjectTemplate[] {
	return PROJECT_TEMPLATES.filter((t) => t.category === category);
}
