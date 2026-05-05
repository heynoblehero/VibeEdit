/**
 * Static texture library — PNG gradients and shapes that ship with the
 * editor. Modelled after src/lib/music-library.ts (the most complete
 * registry in the codebase). Click an entry in the Graphics tab of
 * MediaLibrary → it sets `scene.background.imageUrl` directly.
 */
export type GraphicsKind = "gradient" | "shape";

export interface GraphicAsset {
	id: string;
	name: string;
	src: string;
	kind: GraphicsKind;
	tags: string[];
}

const GRADIENT_TAGS = ["gradient", "background", "issac"];
const SHAPE_TAGS = ["shape", "background", "issac"];

export const GRAPHICS_LIBRARY: GraphicAsset[] = [
	// Gradients (12)
	{ id: "issac-gradient-1", name: "Gradient 1", src: "/graphics/issac-pack/gradient-1.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-2", name: "Gradient 2", src: "/graphics/issac-pack/gradient-2.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-3", name: "Gradient 3", src: "/graphics/issac-pack/gradient-3.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-4", name: "Gradient 4", src: "/graphics/issac-pack/gradient-4.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-5", name: "Gradient 5", src: "/graphics/issac-pack/gradient-5.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-6", name: "Gradient 6", src: "/graphics/issac-pack/gradient-6.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-7", name: "Gradient 7", src: "/graphics/issac-pack/gradient-7.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-8", name: "Gradient 8", src: "/graphics/issac-pack/gradient-8.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-9", name: "Gradient 9", src: "/graphics/issac-pack/gradient-9.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-10", name: "Gradient 10", src: "/graphics/issac-pack/gradient-10.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-11", name: "Gradient 11", src: "/graphics/issac-pack/gradient-11.png", kind: "gradient", tags: GRADIENT_TAGS },
	{ id: "issac-gradient-12", name: "Gradient 12", src: "/graphics/issac-pack/gradient-12.png", kind: "gradient", tags: GRADIENT_TAGS },
	// Shapes (8)
	{ id: "issac-rectangle-1", name: "Rectangle 1", src: "/graphics/issac-pack/rectangle-1.png", kind: "shape", tags: SHAPE_TAGS },
	{ id: "issac-rectangle-2", name: "Rectangle 2", src: "/graphics/issac-pack/rectangle-2.png", kind: "shape", tags: SHAPE_TAGS },
	{ id: "issac-shape-1", name: "Shape 1", src: "/graphics/issac-pack/shape-1.png", kind: "shape", tags: SHAPE_TAGS },
	{ id: "issac-shape-2", name: "Shape 2", src: "/graphics/issac-pack/shape-2.png", kind: "shape", tags: SHAPE_TAGS },
	{ id: "issac-shape-3", name: "Shape 3", src: "/graphics/issac-pack/shape-3.png", kind: "shape", tags: SHAPE_TAGS },
	{ id: "issac-shape-4", name: "Shape 4", src: "/graphics/issac-pack/shape-4.png", kind: "shape", tags: SHAPE_TAGS },
	{ id: "issac-shape-5", name: "Shape 5", src: "/graphics/issac-pack/shape-5.png", kind: "shape", tags: SHAPE_TAGS },
	{ id: "issac-shape-6", name: "Shape 6", src: "/graphics/issac-pack/shape-6.png", kind: "shape", tags: SHAPE_TAGS },
];
