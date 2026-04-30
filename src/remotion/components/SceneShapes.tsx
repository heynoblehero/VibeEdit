import type { SceneShape } from "@/lib/scene-schema";

/**
 * Renders the scene's vector shape stack between the bg media and the
 * text/character/broll layers. SVG for line/circle/triangle, plain DIV
 * for rect — keeps DOM minimal and lets CSS handle filters/transforms.
 */
export function SceneShapes({
  shapes,
  width,
  height,
}: {
  shapes?: SceneShape[];
  width: number;
  height: number;
}) {
  if (!shapes || shapes.length === 0) return null;
  return (
    <>
      {shapes.map((shape) => (
        <ShapeNode key={shape.id} shape={shape} canvasW={width} canvasH={height} />
      ))}
    </>
  );
}

function ShapeNode({
  shape,
  canvasW,
  canvasH,
}: {
  shape: SceneShape;
  canvasW: number;
  canvasH: number;
}) {
  const fill = shape.color ?? "#ffffff";
  const stroke = shape.strokeColor ?? "transparent";
  const strokeWidth = shape.strokeWidth ?? 0;
  const opacity = shape.opacity ?? 1;
  const rot = shape.rotation ?? 0;
  if (shape.kind === "rect") {
    return (
      <div
        style={{
          position: "absolute",
          left: shape.x,
          top: shape.y,
          width: shape.w,
          height: shape.h,
          background: fill,
          border: strokeWidth > 0 ? `${strokeWidth}px solid ${stroke}` : undefined,
          borderRadius: shape.borderRadius ?? 0,
          opacity,
          transform: rot ? `rotate(${rot}deg)` : undefined,
          transformOrigin: "center center",
        }}
      />
    );
  }
  if (shape.kind === "circle") {
    return (
      <div
        style={{
          position: "absolute",
          left: shape.x,
          top: shape.y,
          width: shape.w,
          height: shape.h,
          background: fill,
          border: strokeWidth > 0 ? `${strokeWidth}px solid ${stroke}` : undefined,
          borderRadius: "50%",
          opacity,
          transform: rot ? `rotate(${rot}deg)` : undefined,
          transformOrigin: "center center",
        }}
      />
    );
  }
  if (shape.kind === "line") {
    return (
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: canvasW,
          height: canvasH,
          opacity,
          pointerEvents: "none",
        }}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        <line
          x1={shape.x}
          y1={shape.y}
          x2={shape.x + shape.w}
          y2={shape.y + shape.h}
          stroke={stroke === "transparent" ? fill : stroke}
          strokeWidth={Math.max(2, strokeWidth || 4)}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (shape.kind === "triangle") {
    return (
      <svg
        style={{
          position: "absolute",
          left: shape.x,
          top: shape.y,
          width: shape.w,
          height: shape.h,
          opacity,
          transform: rot ? `rotate(${rot}deg)` : undefined,
          transformOrigin: "center center",
          pointerEvents: "none",
        }}
        viewBox={`0 0 ${shape.w} ${shape.h}`}
      >
        <polygon
          points={`${shape.w / 2},0 ${shape.w},${shape.h} 0,${shape.h}`}
          fill={fill}
          stroke={stroke === "transparent" ? "none" : stroke}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }
  return null;
};
