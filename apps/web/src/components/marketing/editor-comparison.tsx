"use client";

import { motion } from "motion/react";

/* ── Pixel sprite renderer ── */
/* Each row is a string. Each char maps to a color via the palette. "." = transparent */

const S = 4; // pixel size

function Sprite({ rows, palette, className }: { rows: string[]; palette: Record<string, string>; className?: string }) {
	const rects: React.ReactNode[] = [];
	for (let y = 0; y < rows.length; y++) {
		for (let x = 0; x < rows[y].length; x++) {
			const c = rows[y][x];
			if (c !== "." && palette[c]) {
				rects.push(<rect key={`${x}-${y}`} x={x * S} y={y * S} width={S} height={S} fill={palette[c]} />);
			}
		}
	}
	const w = Math.max(...rows.map(r => r.length)) * S;
	const h = rows.length * S;
	return (
		<svg viewBox={`0 0 ${w} ${h}`} className={className} xmlns="http://www.w3.org/2000/svg">
			{rects}
		</svg>
	);
}

/* ── Color palettes ── */

const karateColors: Record<string, string> = {
	// Skin
	"s": "#f8b878", "S": "#d08050",
	// Hair
	"h": "#282018", "H": "#181010",
	// Eyes
	"e": "#ffffff", "E": "#181820", "r": "#cc2020",
	// Karate gi (white)
	"w": "#f0f0f0", "W": "#c8c8c8", "G": "#b0b0b0",
	// Belt
	"b": "#181820", "B": "#303030",
	// Headband
	"R": "#e03030", "Q": "#a82020",
	// Vein/steam
	"v": "#e04040",
	// Sweat
	"a": "#60a5fa",
	// Mouth
	"m": "#a04030",
	// Bags under eyes
	"g": "#c09070",
};

const chillColors: Record<string, string> = {
	// Skin
	"s": "#f8b878", "S": "#d08050",
	// Hair
	"h": "#282018", "H": "#181010",
	// Sunglasses
	"g": "#181830", "G": "#252545",
	// Shirt
	"t": "#38c8b0", "T": "#28a898",
	// Shorts
	"p": "#9060e8", "P": "#7040c0",
	// Smile
	"m": "#a06850",
	// Coconut
	"c": "#a07048", "C": "#805830",
	// Straw/umbrella
	"r": "#e03030", "y": "#f8d830",
	// Laptop
	"l": "#404060", "L": "#303050",
	// Screen
	"V": "#9060e8", "k": "#30d850",
};

/* ── KARATE GUY SPRITE ── */
/* 36 wide × 55 tall - hunched at desk, raging */

const karateSprite = [
	// Steam/veins above head
	"......v.......v.v.....................",
	"....v...v...v......v.................",
	"..............v......................",
	// Hair top
	"..........hhhhhhhh...................",
	".........hhHHHHHHhh..................",
	"........hhHHHHHHHHhh.................",
	"........hHHHHHHHHHHh.................",
	// Headband
	".......RRRRRRRRRRRRRQQq.............",
	"......RRRRRRRRRRRRRRRQQq............",
	// Forehead + hair sides
	"......hssssssssssssSh..QQ............",
	".....hhssssssssssssShh..Q............",
	// Eyes row — rage: angled brows, bloodshot
	".....hEEErssrEEErssSh...............",
	".....hEEErssrEEErssSh...............",
	// Under-eye bags
	".....hsggssssggssssSh...............",
	// Nose
	"......sssssSSSsssssSh...............",
	// Mouth — gritted teeth, open yelling
	"......sssmmmmmmmssSh................",
	"......sssmEwEwEmsSh.................",
	"......sssmmmmmmmssh.................",
	// Chin
	".......ssssssssssh..................",
	"........sSSSSSSSh...................",
	// Neck
	"..........ssss......................",
	// Shoulders + gi top — hunched forward
	".......WWwwwwwwwwWW.................",
	"......WWwwwwwwwwwwWW................",
	".....GWwwwwwwwwwwwwWG...............",
	".....Gwwwwwwwwwwwwwwg...............",
	// Black belt
	".....bbbbbbbBBBBBbbbb...............",
	// Gi bottom
	".....Gwwwwwwwwwwwwwwg...............",
	".....GwwwwwwwwwwwwwWG...............",
	// Arms reaching forward to keyboard — hunched
	"...ssWwwwWss....ssWwwWss............",
	"..ss.WwwW.ss....ss.WwW.ss..........",
	".ss...WW...ss..ss...WW..ss.........",
	"ss.........sssss..........s........",
	// Hands on keyboard area
	"...........ssSss....................",
	// Legs on chair
	".....wwwww....wwwww.................",
	".....wwwww....wwwww.................",
	// Feet
	"....bbbbb....bbbbb..................",
];

/* ── CHILL GUY SPRITE ── */
/* 36 wide × 50 tall - reclined, coconut, laptop */

const chillSprite = [
	// Hair
	"..........hhhhhhh....................",
	".........hHHHHHHHh...................",
	"........hHHHHHHHHHh.................",
	"........hHHHHHHHHHh.................",
	// Sunglasses + face
	"........sggggsggggs..................",
	"........sGGGGsGGGGs..................",
	"........ssssssssssS..................",
	// Smile
	".........ssmmmmsS....................",
	"..........sssssS.....................",
	// Neck
	"...........sss.......................",
	// Shoulders — leaned back, one arm up holding drink
	"........TTttttttTT.......r...........",
	".......TTtttttttttT.....ry...........",
	"......sTttttttttttsS...ccy...........",
	"......s.TttttttttT.sS..ccC..........",
	// Arm going to coconut
	".........TttttT..ssS..CC............",
	"..........TttT....sS................",
	// Other arm on laptop
	"...........ss....sS.................",
	// Laptop on lap
	"...........lllllls...................",
	"...........LVkVLLs...................",
	"...........llllll....................",
	// Shorts + legs stretched
	"..........pppppp.....................",
	".........pppppppp....................",
	"........sPP....PPsssss..............",
	".......ss.PP...PP....ssss...........",
	"......ss...........s....ss..........",
	// Feet
	"...........................ss.......",
];

/* ── MONITOR SPRITES ── */

const premierePalette: Record<string, string> = {
	"f": "#1a1a2e", // frame
	"F": "#252540", // frame highlight
	"d": "#0f0f1a", // dark screen
	"b": "#3060d0", // premiere blue
	"B": "#2040a0",
	"p": "#9060e8", // purple track
	"g": "#30c850", // green track
	"r": "#e04040", // red error
	"R": "#c02020",
	"o": "#e88030", // orange track
	"y": "#f0d020", // yellow
	"w": "#ffffff",
	"W": "#c0c0c0",
	"t": "#808080", // timeline gray
	"T": "#606060",
	"e": "#e04040", // error bar
	"s": "#404060", // statusbar
};

// Premiere Pro + After Effects split screen ~30x20
const premiereScreen = [
	"fffffffffffffffffffffffffffffffF",
	"fddddddddddddddddddddddddddddF",
	"fdbbBBbbBdddddddddddddddddddddF",
	"fddddddddddddddddddddddddddddF",
	"fdrrrrrrrrrrrrrrrrrerrrrrrrrrrrdF",
	"fdwwwwwERRORwwRenderwFailedwwwrdF",
	"fdrrrrrrrrrrrrrrrrrrrrrrrrrrrrrdF",
	"fddddddddddddddddddddddddddddF",
	"fdtTtTtTtTtTtTtTtTtTtTtTtTtTtTdF",
	"fdpppppp..oooo..gggg....pppp..dF",
	"fd..oooooo..pppppp..gggggg..ppdF",
	"fdgggg..pppppp..oooo..pppp..oodF",
	"fd..pppp..gggg..oooooo..gggg.dF",
	"fdoooo..gggggg..pppp..oooo..ppdF",
	"fd..gggg..pppp..oooooo..pppp.dF",
	"fdtTtTtTtTtTtTtTtTtTtTtTtTtTtTdF",
	"fdsssssssssssssssssssssssssssstF",
	"fdsRender:s47%s||sEstimate:s8hdF",
	"fddddddddddddddddddddddddddddF",
	"fffffffffffffffffffffffffffffffF",
];

const vibeEditPalette: Record<string, string> = {
	"f": "#1a1a2e",
	"F": "#252540",
	"d": "#0f0f1a",
	"p": "#7c3aed", // purple bubbles
	"P": "#6030c0",
	"g": "#30d850", // green = AI response
	"G": "#22a840",
	"k": "#30d850", // checkmark green
	"w": "#ffffff",
	"W": "#a0a0b0",
	"b": "#08080c",
	"s": "#404060",
};

// VibeEdit clean chat + checkmark ~30x20
const vibeEditScreen = [
	"fffffffffffffffffffffffffffffffF",
	"fddddddddddddddddddddddddddddF",
	"fddddddddddddddddddddddddddddF",
	"fddddddddddddppppppppppppdddddF",
	"fddddddddddddpAddpcaptionddddddF",
	"fddddddddddddppppppppppppddddddF",
	"fddddddddddddddddddddddddddddF",
	"fdddgggggggggggggggddddddddddddF",
	"fdddgDone!gExportedggddddddddddF",
	"fdddggggggggggggggggdddddddddddF",
	"fddddddddddddddddddddddddddddF",
	"fddddddddddddddddddddddddddddF",
	"fdddddddddddkkkkkkdddddddddddddF",
	"fddddddddddkddddddkddddddddddddF",
	"fdddddddddddddddkdkddddddddddddF",
	"fddddddddddddddkddddddddddddddF",
	"fdddddddddddddkdddddddddddddddF",
	"fddddddddddddddddddddddddddddF",
	"fddddddddddddddddddddddddddddF",
	"fffffffffffffffffffffffffffffffF",
];

/* ── Monitor components ── */

function PremiereMonitor({ className }: { className?: string }) {
	return (
		<div className={className}>
			<Sprite rows={premiereScreen} palette={premierePalette} className="w-full rounded-sm" />
			{/* Flicker overlay */}
			<motion.div
				className="absolute inset-0 rounded-sm bg-red-500/5"
				animate={{ opacity: [0, 0.08, 0] }}
				transition={{ duration: 2, repeat: Infinity }}
			/>
		</div>
	);
}

function VibeEditMonitor({ className }: { className?: string }) {
	return (
		<div className={className}>
			<Sprite rows={vibeEditScreen} palette={vibeEditPalette} className="w-full rounded-sm" />
		</div>
	);
}

/* ── Main component ── */

export function EditorComparison() {
	return (
		<div className="mx-auto max-w-5xl px-6">
			<div className="relative grid grid-cols-1 sm:grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-white/[0.08]">
				{/* ── LEFT: Karate guy ── */}
				<div className="relative bg-gradient-to-b from-red-950/60 to-[#0a0608] p-6 sm:p-8 border-b sm:border-b-0 sm:border-r border-white/[0.06]">
					<div className="flex flex-col items-center gap-4">
						{/* Monitor */}
						<div className="relative w-full max-w-[240px]">
							<PremiereMonitor className="relative" />
						</div>

						{/* Character */}
						<motion.div
							className="w-full max-w-[200px]"
							animate={{ y: [0, -2, 0, 2, 0], rotate: [0, -0.5, 0, 0.5, 0] }}
							transition={{ duration: 0.6, repeat: Infinity }}
						>
							<Sprite rows={karateSprite} palette={karateColors} className="w-full" />
						</motion.div>

						{/* Sweat particles */}
						<motion.div className="absolute top-20 right-8"
							animate={{ opacity: [0, 0.8, 0], y: [0, 20] }}
							transition={{ duration: 1.2, repeat: Infinity }}
						>
							<span className="text-blue-400 text-lg">💧</span>
						</motion.div>
						<motion.div className="absolute top-32 right-16"
							animate={{ opacity: [0, 0.6, 0], y: [0, 16] }}
							transition={{ duration: 1.2, repeat: Infinity, delay: 0.5 }}
						>
							<span className="text-blue-400 text-sm">💧</span>
						</motion.div>
						{/* Steam */}
						<motion.div className="absolute top-12 left-1/2 -translate-x-1/2"
							animate={{ opacity: [0, 0.5, 0], y: [0, -12] }}
							transition={{ duration: 1.5, repeat: Infinity }}
						>
							<span className="text-red-400/60 text-xl">💢</span>
						</motion.div>
					</div>

					<div className="text-center mt-4">
						<p className="text-red-400 font-black font-[family-name:var(--font-display)] text-2xl sm:text-3xl">20+ hrs</p>
						<p className="text-white/50 text-sm sm:text-base mt-1 font-medium">&ldquo;You editing in Premiere&rdquo;</p>
					</div>
				</div>

				{/* ── RIGHT: Beach guy ── */}
				<div className="relative bg-gradient-to-b from-cyan-950/40 via-violet-950/30 to-[#0a0610] p-6 sm:p-8">
					<div className="flex flex-col items-center gap-4">
						{/* Monitor */}
						<div className="relative w-full max-w-[240px]">
							<VibeEditMonitor className="relative" />
						</div>

						{/* Character */}
						<motion.div
							className="w-full max-w-[200px]"
							animate={{ y: [0, -1, 0] }}
							transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
						>
							<Sprite rows={chillSprite} palette={chillColors} className="w-full" />
						</motion.div>

						{/* Sparkles around */}
						<motion.div className="absolute top-16 right-12"
							animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
							transition={{ duration: 2, repeat: Infinity }}
						>
							<span className="text-yellow-300 text-sm">✨</span>
						</motion.div>
						<motion.div className="absolute top-28 left-8"
							animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
							transition={{ duration: 2, repeat: Infinity, delay: 0.8 }}
						>
							<span className="text-violet-300 text-sm">✨</span>
						</motion.div>
					</div>

					<div className="text-center mt-4">
						<p className="text-emerald-400 font-black font-[family-name:var(--font-display)] text-2xl sm:text-3xl">10 mins</p>
						<p className="text-white/50 text-sm sm:text-base mt-1 font-medium">&ldquo;You with VibeEdit&rdquo;</p>
					</div>
				</div>

				{/* VS divider */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<motion.div
						className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#08080c] border-2 border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.9)]"
						animate={{ scale: [1, 1.1, 1] }}
						transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
					>
						<span className="text-white/70 font-black text-sm sm:text-base font-[family-name:var(--font-display)]">VS</span>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
