"use client";

import {
	forwardRef,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from "react";
import { type AccentName, cls } from "@/lib/design/tokens";

const INPUT_BASE =
	"w-full px-2.5 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-[13px] text-neutral-100 placeholder:text-neutral-600 transition-colors duration-150 focus:outline-none";

const ACCENT_FOCUS: Record<AccentName, string> = {
	video: "focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20",
};

export function Label({
	children,
	htmlFor,
	hint,
	accent: accentName,
}: {
	children: ReactNode;
	htmlFor?: string;
	hint?: ReactNode;
	accent?: AccentName;
}) {
	const accentCls = accentName ? "text-emerald-300/80" : "text-neutral-400";
	return (
		<label
			htmlFor={htmlFor}
			className={cls(
				"block text-[10px] uppercase tracking-wider font-semibold",
				accentCls,
			)}
		>
			{children}
			{hint ? <span className="ml-1.5 normal-case tracking-normal text-neutral-500 font-normal">{hint}</span> : null}
		</label>
	);
}

export function Field({
	label,
	hint,
	children,
	accent: accentName,
}: {
	label: ReactNode;
	hint?: ReactNode;
	children: ReactNode;
	accent?: AccentName;
}) {
	return (
		<div className="space-y-1">
			<Label hint={hint} accent={accentName}>
				{label}
			</Label>
			{children}
		</div>
	);
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	accent?: AccentName;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ accent: accentName = "video", className, ...rest },
	ref,
) {
	return (
		<input
			ref={ref}
			className={cls(INPUT_BASE, ACCENT_FOCUS[accentName], className)}
			{...rest}
		/>
	);
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	accent?: AccentName;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	function Textarea({ accent: accentName = "video", className, ...rest }, ref) {
		return (
			<textarea
				ref={ref}
				className={cls(
					INPUT_BASE,
					"resize-none leading-relaxed",
					ACCENT_FOCUS[accentName],
					className,
				)}
				{...rest}
			/>
		);
	},
);

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	accent?: AccentName;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
	{ accent: accentName = "video", className, children, ...rest },
	ref,
) {
	return (
		<select
			ref={ref}
			className={cls(INPUT_BASE, "cursor-pointer", ACCENT_FOCUS[accentName], className)}
			{...rest}
		>
			{children}
		</select>
	);
});

/**
 * Range slider with consistent tinting + tabular value readout.
 * Always pass `valueLabel` so the user sees the number; otherwise
 * sliders feel like they do nothing.
 */
interface RangeProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	accent?: AccentName;
	valueLabel?: string;
}

export const Range = forwardRef<HTMLInputElement, RangeProps>(function Range(
	{ accent: accentName = "video", valueLabel, className, ...rest },
	ref,
) {
	const accentMap: Record<AccentName, string> = {
		video: "accent-emerald-400",
	};
	return (
		<div className="space-y-1">
			<input
				ref={ref}
				type="range"
				className={cls("w-full cursor-pointer", accentMap[accentName], className)}
				{...rest}
			/>
			{valueLabel ? (
				<div className="text-right text-[10px] font-mono tabular-nums text-neutral-500">
					{valueLabel}
				</div>
			) : null}
		</div>
	);
});
