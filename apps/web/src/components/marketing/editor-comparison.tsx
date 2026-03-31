"use client";

import { motion } from "motion/react";

function StressedEditor() {
	return (
		<svg viewBox="0 0 260 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{/* Desk */}
			<rect x="30" y="200" width="200" height="12" rx="3" fill="#2a1a1a" />
			{/* Desk legs */}
			<rect x="50" y="212" width="8" height="50" rx="2" fill="#1f1111" />
			<rect x="202" y="212" width="8" height="50" rx="2" fill="#1f1111" />

			{/* Monitor */}
			<rect x="70" y="130" width="120" height="70" rx="6" fill="#1a1a2e" stroke="#333" strokeWidth="2" />
			{/* Screen content — messy timeline */}
			<rect x="78" y="138" width="104" height="54" rx="2" fill="#0f0f1a" />
			{/* Timeline bars (mess) */}
			<rect x="82" y="165" width="40" height="4" rx="1" fill="#ef4444" opacity="0.6" />
			<rect x="82" y="172" width="60" height="4" rx="1" fill="#f97316" opacity="0.5" />
			<rect x="82" y="179" width="35" height="4" rx="1" fill="#ef4444" opacity="0.4" />
			<rect x="126" y="165" width="25" height="4" rx="1" fill="#f97316" opacity="0.5" />
			<rect x="148" y="172" width="30" height="4" rx="1" fill="#ef4444" opacity="0.3" />
			<rect x="82" y="142" width="96" height="18" rx="2" fill="#1a1a2e" />
			{/* Error popup */}
			<rect x="100" y="144" width="60" height="14" rx="3" fill="#dc2626" opacity="0.8" />
			<text x="112" y="154" fill="white" fontSize="7" fontFamily="system-ui" fontWeight="600">ERROR</text>
			{/* Monitor stand */}
			<rect x="122" y="200" width="16" height="6" rx="1" fill="#333" />
			<rect x="114" y="196" width="32" height="6" rx="2" fill="#2a2a2a" />

			{/* Chair */}
			<ellipse cx="130" cy="230" rx="30" ry="6" fill="#1f1111" opacity="0.5" />

			{/* Body — hunched forward */}
			<ellipse cx="130" cy="195" rx="22" ry="16" fill="#4a3f5c" />

			{/* Head — big chibi head */}
			<motion.g animate={{ y: [0, 1, 0, -1, 0], rotate: [0, -1, 0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
				<circle cx="130" cy="145" r="32" fill="#fcd9b6" />
				{/* Headband */}
				<path d="M100 138c8-6 20-10 30-10s22 4 30 10" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" fill="none" />
				<path d="M162 136l8 8 4-12" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" fill="none" />
				{/* Messy hair */}
				<path d="M102 132c-2-12 4-22 14-28 6-4 14-5 14-5s8 1 14 5c10 6 16 16 14 28" fill="#3a2518" />
				<path d="M106 130c2-8 6-14 12-14" stroke="#3a2518" strokeWidth="3" strokeLinecap="round" />
				<path d="M154 130c-2-8-6-14-12-14" stroke="#3a2518" strokeWidth="3" strokeLinecap="round" />
				{/* Stray hair */}
				<motion.path d="M118 104c-4-8-1-14 3-16" stroke="#3a2518" strokeWidth="2" strokeLinecap="round" fill="none"
					animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 0.5, repeat: Infinity }} />

				{/* Eyes — stressed, bags underneath */}
				<ellipse cx="120" cy="148" rx="5" ry="4" fill="white" />
				<circle cx="121" cy="149" r="2.5" fill="#1a1a2e" />
				<ellipse cx="140" cy="148" rx="5" ry="4" fill="white" />
				<circle cx="141" cy="149" r="2.5" fill="#1a1a2e" />
				{/* Eye bags */}
				<path d="M115 153c2 2 5 2 7 0" stroke="#d4a88c" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
				<path d="M137 153c2 2 5 2 7 0" stroke="#d4a88c" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
				{/* Frown */}
				<path d="M123 162c3 2 7 2 10 0" stroke="#8a6550" strokeWidth="2" strokeLinecap="round" fill="none" />
				{/* Eyebrows — worried */}
				<path d="M114 140l8-3" stroke="#3a2518" strokeWidth="2" strokeLinecap="round" />
				<path d="M146 140l-8-3" stroke="#3a2518" strokeWidth="2" strokeLinecap="round" />
			</motion.g>

			{/* Sweat drops */}
			<motion.g animate={{ opacity: [0, 1, 0], y: [0, 8, 16] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}>
				<circle cx="165" cy="140" r="3" fill="#60a5fa" opacity="0.5" />
			</motion.g>
			<motion.g animate={{ opacity: [0, 1, 0], y: [0, 6, 12] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.7 }}>
				<circle cx="98" cy="148" r="2.5" fill="#60a5fa" opacity="0.4" />
			</motion.g>

			{/* Arms on keyboard */}
			<path d="M108 192c-8 4-14 10-14 14" stroke="#fcd9b6" strokeWidth="8" strokeLinecap="round" />
			<path d="M152 192c8 4 14 10 14 14" stroke="#fcd9b6" strokeWidth="8" strokeLinecap="round" />

			{/* Keyboard */}
			<rect x="88" y="204" width="84" height="8" rx="2" fill="#2a2a3a" />
		</svg>
	);
}

function ChillEditor() {
	return (
		<svg viewBox="0 0 260 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{/* Desk */}
			<rect x="30" y="200" width="200" height="12" rx="3" fill="#1a1a2e" />
			<rect x="50" y="212" width="8" height="50" rx="2" fill="#151525" />
			<rect x="202" y="212" width="8" height="50" rx="2" fill="#151525" />

			{/* Monitor */}
			<rect x="70" y="130" width="120" height="70" rx="6" fill="#1a1a2e" stroke="#444" strokeWidth="2" />
			<rect x="78" y="138" width="104" height="54" rx="2" fill="#0f0f1a" />
			{/* Screen — clean chat interface */}
			<rect x="84" y="142" width="50" height="10" rx="4" fill="#7c3aed" opacity="0.6" />
			<rect x="92" y="156" width="60" height="10" rx="4" fill="#22c55e" opacity="0.4" />
			<rect x="84" y="170" width="42" height="10" rx="4" fill="#7c3aed" opacity="0.5" />
			{/* Checkmark */}
			<circle cx="160" cy="166" r="10" fill="#22c55e" opacity="0.3" />
			<path d="M155 166l4 4 7-8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			{/* Monitor stand */}
			<rect x="122" y="200" width="16" height="6" rx="1" fill="#333" />
			<rect x="114" y="196" width="32" height="6" rx="2" fill="#2a2a2a" />

			{/* Chair */}
			<ellipse cx="130" cy="230" rx="30" ry="6" fill="#151525" opacity="0.5" />

			{/* Body — leaned back */}
			<ellipse cx="130" cy="195" rx="22" ry="16" fill="#4a3f6c" />

			{/* Head — big chibi head, slightly tilted back */}
			<motion.g animate={{ y: [0, -1, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
				<circle cx="130" cy="145" r="32" fill="#fcd9b6" />
				{/* Clean hair */}
				<path d="M100 134c0-18 12-30 30-30s30 12 30 30" fill="#2a1a10" />
				{/* Cool hair swoop */}
				<path d="M108 130c4-14 14-22 26-22 8 0 14 4 18 10" fill="#3a2518" />

				{/* Sunglasses */}
				<rect x="110" y="142" width="16" height="12" rx="4" fill="#1a1a2e" />
				<rect x="134" y="142" width="16" height="12" rx="4" fill="#1a1a2e" />
				<path d="M126 148h8" stroke="#1a1a2e" strokeWidth="2" />
				<path d="M110 146l-6-2" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />
				{/* Lens shine */}
				<motion.rect x="113" y="144" width="4" height="2" rx="1" fill="white" opacity="0.3"
					animate={{ opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 2, repeat: Infinity }} />

				{/* Smile */}
				<path d="M120 162c4 4 12 4 16 0" stroke="#8a6550" strokeWidth="2" strokeLinecap="round" fill="none" />

				{/* Slight blush */}
				<circle cx="112" cy="158" r="5" fill="#f472b6" opacity="0.15" />
				<circle cx="148" cy="158" r="5" fill="#f472b6" opacity="0.15" />
			</motion.g>

			{/* Left arm — resting on desk */}
			<path d="M108 192c-10 4-16 10-14 14" stroke="#fcd9b6" strokeWidth="8" strokeLinecap="round" />

			{/* Right arm — holding drink */}
			<motion.g animate={{ rotate: [0, -3, 0, 3, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ originX: "152px", originY: "192px" }}>
				<path d="M152 192c10 0 18 4 22 10" stroke="#fcd9b6" strokeWidth="8" strokeLinecap="round" />
				{/* Drink */}
				<g transform="translate(170, 186)">
					<rect x="0" y="0" width="14" height="20" rx="3" fill="#a78bfa" />
					<rect x="1" y="2" width="12" height="6" rx="2" fill="#c4b5fd" opacity="0.5" />
					{/* Straw */}
					<line x1="10" y1="-4" x2="8" y2="6" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
					{/* Bubbles */}
					<motion.circle cx="5" cy="14" r="1.5" fill="white" opacity="0.3"
						animate={{ y: [14, 8, 4], opacity: [0, 0.4, 0] }} transition={{ duration: 2, repeat: Infinity }} />
				</g>
			</motion.g>

			{/* Keyboard — barely touched */}
			<rect x="88" y="204" width="84" height="8" rx="2" fill="#2a2a3a" />
		</svg>
	);
}

export function EditorComparison() {
	return (
		<div className="mx-auto max-w-4xl px-6">
			<div className="relative grid grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-white/[0.08]">
				{/* Left — Stressed traditional editor */}
				<div className="relative bg-gradient-to-br from-red-950/40 to-[#0c0c0c] p-4 sm:p-8 border-r border-white/[0.06]">
					<div className="mx-auto max-w-[220px] aspect-square">
						<StressedEditor />
					</div>
					<div className="text-center mt-2">
						<p className="text-red-400 font-black font-[family-name:var(--font-display)] text-2xl sm:text-3xl">20+ hrs</p>
						<p className="text-white/40 text-xs sm:text-sm mt-1">Traditional editing</p>
					</div>
				</div>

				{/* Right — Chill VibeEdit user */}
				<div className="relative bg-gradient-to-br from-violet-950/40 to-[#0c0c0c] p-4 sm:p-8">
					<div className="mx-auto max-w-[220px] aspect-square">
						<ChillEditor />
					</div>
					<div className="text-center mt-2">
						<p className="text-emerald-400 font-black font-[family-name:var(--font-display)] text-2xl sm:text-3xl">10 mins</p>
						<p className="text-white/40 text-xs sm:text-sm mt-1">VibeEdit</p>
					</div>
				</div>

				{/* VS divider */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<motion.div
						className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#08080c] border-2 border-white/20 flex items-center justify-center"
						animate={{ scale: [1, 1.08, 1] }}
						transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
					>
						<span className="text-white/60 font-black text-xs sm:text-sm font-[family-name:var(--font-display)]">VS</span>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
