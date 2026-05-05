import { AbsoluteFill } from "remotion";
import type { AnimationSpec, AnimationTemplateId } from "@/lib/animate/spec";
import { BigNumber } from "./templates/BigNumber";
import { BulletList } from "./templates/BulletList";
import { KineticTitle } from "./templates/KineticTitle";
import { LogoReveal } from "./templates/LogoReveal";
import { LowerThird } from "./templates/LowerThird";
import { QuoteCard } from "./templates/QuoteCard";

/**
 * Renders one AnimationSpec by dispatching on templateId. The Remotion
 * Player (client preview) and renderMedia() (server render) both feed
 * this component the spec via inputProps.
 *
 * Adding a template = add a file under templates/ and a case here.
 */
export interface AnimationCompositionProps extends Record<string, unknown> {
	templateId?: AnimationTemplateId;
	props?: Record<string, unknown>;
}

const FALLBACK_PROPS: Record<AnimationTemplateId, Record<string, unknown>> = {
	"kinetic-title": {
		text: "Make it move",
		color: "#ffffff",
		background: "#0a0a0a",
		accent: "#ec4899",
	},
	"lower-third": {
		name: "Speaker name",
		role: "Title",
		background: "transparent",
		accent: "#ec4899",
		textColor: "#ffffff",
	},
	"big-number": {
		value: 100,
		color: "#ffffff",
		background: "#0a0a0a",
		accent: "#ec4899",
	},
	"quote-card": {
		quote: "Quote",
		background: "#0a0a0a",
		textColor: "#ffffff",
		accent: "#ec4899",
	},
	"bullet-list": {
		bullets: ["One", "Two", "Three"],
		background: "#0a0a0a",
		textColor: "#ffffff",
		accent: "#ec4899",
	},
	"logo-reveal": {
		imageUrl: "",
		background: "#0a0a0a",
		accent: "#ec4899",
	},
};

export const AnimationComposition: React.FC<AnimationCompositionProps> = ({
	templateId = "kinetic-title",
	props = {},
}) => {
	const tid = templateId as AnimationTemplateId;
	const merged = { ...FALLBACK_PROPS[tid], ...props };

	switch (tid) {
		case "kinetic-title":
			// biome-ignore lint/suspicious/noExplicitAny: template props are spec-validated upstream
			return <KineticTitle {...(merged as any)} />;
		case "lower-third":
			// biome-ignore lint/suspicious/noExplicitAny: template props are spec-validated upstream
			return <LowerThird {...(merged as any)} />;
		case "big-number":
			// biome-ignore lint/suspicious/noExplicitAny: template props are spec-validated upstream
			return <BigNumber {...(merged as any)} />;
		case "quote-card":
			// biome-ignore lint/suspicious/noExplicitAny: template props are spec-validated upstream
			return <QuoteCard {...(merged as any)} />;
		case "bullet-list":
			// biome-ignore lint/suspicious/noExplicitAny: template props are spec-validated upstream
			return <BulletList {...(merged as any)} />;
		case "logo-reveal":
			// biome-ignore lint/suspicious/noExplicitAny: template props are spec-validated upstream
			return <LogoReveal {...(merged as any)} />;
		default:
			return (
				<AbsoluteFill style={{ background: "#0a0a0a", color: "#fff" }}>
					Unknown template: {String(tid)}
				</AbsoluteFill>
			);
	}
};

export type { AnimationSpec };
