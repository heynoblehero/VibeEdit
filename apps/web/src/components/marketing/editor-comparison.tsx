"use client";

import { motion } from "motion/react";

/* Helper — draw a pixel block */
const P = ({ x, y, c, s = 5 }: { x: number; y: number; c: string; s?: number }) => (
	<rect x={x * s} y={y * s} width={s} height={s} fill={c} />
);

/* Retro palette */
const SKIN = "#f8b878";
const SKIN_S = "#d08050"; // shadow
const WHITE = "#f0f0f0";
const WHITE_S = "#c8c8c8";
const BLACK = "#181820";
const RED = "#e03030";
const RED_D = "#a82020";
const BROWN = "#805830";
const BROWN_D = "#604020";
const BEIGE = "#d8c8a0";
const BEIGE_D = "#b0a078";
const GREEN_CRT = "#30d850";
const GREEN_D = "#208838";
const TEAL = "#38c8b0";
const PURPLE = "#9060e8";
const BLUE = "#3888e8";
const BLUE_D = "#2060a8";
const YELLOW = "#f8d830";
const ORANGE = "#e88030";
const SAND = "#e8d8a0";
const SAND_D = "#c8b878";
const COCONUT = "#a07048";
const PALM = "#28a040";
const PALM_D = "#188828";
const TRUNK = "#906830";

function KarateGuy() {
	return (
		<svg viewBox="0 0 200 220" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
			{/* === CRT MONITOR === */}
			{/* Monitor body */}
			{[0,1,2,3,4,5,6,7,8].map(x => [0,1,2,3,4,5,6].map(y =>
				<P key={`m${x}${y}`} x={3+x} y={20+y} c={x===0||x===8||y===0||y===6 ? BEIGE_D : BEIGE} />
			))}
			{/* Screen (green CRT) */}
			{[1,2,3,4,5,6,7].map(x => [1,2,3,4,5].map(y =>
				<P key={`s${x}${y}`} x={3+x} y={20+y} c={BLACK} />
			))}
			{/* Green text lines on CRT */}
			<P x={5} y={22} c={GREEN_CRT} /><P x={6} y={22} c={GREEN_CRT} /><P x={7} y={22} c={GREEN_D} />
			<P x={5} y={23} c={GREEN_D} /><P x={6} y={23} c={GREEN_CRT} />
			<P x={5} y={24} c={GREEN_CRT} /><P x={6} y={24} c={GREEN_D} /><P x={7} y={24} c={GREEN_CRT} /><P x={8} y={24} c={GREEN_D} />
			{/* CRT flicker */}
			<motion.rect x={20} y={105} width={35} height={25} fill={GREEN_CRT} opacity={0.03}
				animate={{ opacity: [0.02, 0.06, 0.02] }} transition={{ duration: 0.15, repeat: Infinity }} />
			{/* Monitor stand */}
			<P x={6} y={27} c={BEIGE_D} /><P x={7} y={27} c={BEIGE_D} />
			<P x={5} y={28} c={BEIGE_D} /><P x={6} y={28} c={BEIGE} /><P x={7} y={28} c={BEIGE} /><P x={8} y={28} c={BEIGE_D} />

			{/* === KEYBOARD === */}
			{[4,5,6,7,8,9].map(x => <P key={`k${x}`} x={x} y={29} c={x===4||x===9 ? "#606060" : "#808080"} />)}

			{/* === DESK === */}
			{Array.from({length: 16}, (_,i) => <P key={`d${i}`} x={1+i} y={30} c={BROWN} />)}
			{Array.from({length: 16}, (_,i) => <P key={`d2${i}`} x={1+i} y={31} c={BROWN_D} />)}
			{/* Desk legs */}
			<P x={2} y={32} c={BROWN_D} /><P x={2} y={33} c={BROWN_D} />
			<P x={15} y={32} c={BROWN_D} /><P x={15} y={33} c={BROWN_D} />

			{/* === CHARACTER — karate guy hunched over === */}
			{/* Headband */}
			<P x={17} y={16} c={RED} /><P x={18} y={16} c={RED} /><P x={19} y={16} c={RED} /><P x={20} y={16} c={RED} /><P x={21} y={16} c={RED} />
			{/* Headband tail */}
			<P x={22} y={16} c={RED_D} /><P x={23} y={17} c={RED_D} /><P x={24} y={17} c={RED} />
			<motion.g animate={{ y: [0, -1, 0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }}>
				<P x={25} y={17} c={RED} /><P x={25} y={18} c={RED_D} />
			</motion.g>

			{/* Hair */}
			<P x={17} y={15} c={BLACK} /><P x={18} y={15} c={BLACK} /><P x={19} y={15} c={BLACK} /><P x={20} y={15} c={BLACK} /><P x={21} y={15} c={BLACK} />
			<P x={18} y={14} c={BLACK} /><P x={19} y={14} c={BLACK} /><P x={20} y={14} c={BLACK} />

			{/* Head */}
			<P x={17} y={17} c={SKIN} /><P x={18} y={17} c={SKIN} /><P x={19} y={17} c={SKIN} /><P x={20} y={17} c={SKIN} /><P x={21} y={17} c={SKIN_S} />
			<P x={17} y={18} c={SKIN} /><P x={18} y={18} c={SKIN} /><P x={19} y={18} c={SKIN} /><P x={20} y={18} c={SKIN} /><P x={21} y={18} c={SKIN_S} />
			{/* Eyes — stressed */}
			<P x={18} y={17} c={BLACK} /><P x={20} y={17} c={BLACK} />
			{/* Frown */}
			<P x={18} y={19} c={SKIN_S} /><P x={19} y={19} c={BLACK} /><P x={20} y={19} c={SKIN_S} />

			{/* Body — white karate gi */}
			<P x={16} y={20} c={WHITE_S} /><P x={17} y={20} c={WHITE} /><P x={18} y={20} c={WHITE} /><P x={19} y={20} c={WHITE} /><P x={20} y={20} c={WHITE} /><P x={21} y={20} c={WHITE_S} />
			<P x={16} y={21} c={WHITE_S} /><P x={17} y={21} c={WHITE} /><P x={18} y={21} c={WHITE} /><P x={19} y={21} c={WHITE} /><P x={20} y={21} c={WHITE} /><P x={21} y={21} c={WHITE_S} />
			<P x={16} y={22} c={WHITE_S} /><P x={17} y={22} c={WHITE} /><P x={18} y={22} c={WHITE} /><P x={19} y={22} c={WHITE} /><P x={20} y={22} c={WHITE} /><P x={21} y={22} c={WHITE_S} />
			{/* Black belt */}
			<P x={16} y={23} c={BLACK} /><P x={17} y={23} c={BLACK} /><P x={18} y={23} c={BLACK} /><P x={19} y={23} c={BLACK} /><P x={20} y={23} c={BLACK} /><P x={21} y={23} c={BLACK} />

			{/* Arms reaching to keyboard */}
			<P x={14} y={22} c={WHITE} /><P x={13} y={23} c={WHITE} /><P x={12} y={24} c={SKIN} /><P x={11} y={25} c={SKIN} /><P x={10} y={26} c={SKIN} /><P x={10} y={27} c={SKIN} /><P x={10} y={28} c={SKIN} />
			<P x={22} y={22} c={WHITE_S} /><P x={23} y={23} c={WHITE_S} /><P x={23} y={24} c={SKIN_S} /><P x={22} y={25} c={SKIN_S} /><P x={21} y={26} c={SKIN} /><P x={20} y={27} c={SKIN} /><P x={19} y={28} c={SKIN} />

			{/* Legs */}
			<P x={17} y={24} c={WHITE} /><P x={18} y={24} c={WHITE} /><P x={19} y={24} c={WHITE} /><P x={20} y={24} c={WHITE_S} />
			<P x={17} y={25} c={WHITE} /><P x={18} y={25} c={WHITE} /><P x={19} y={25} c={WHITE_S} /><P x={20} y={25} c={WHITE_S} />
			{/* Chair pixel */}
			<P x={15} y={26} c={BROWN} /><P x={16} y={26} c={BROWN} /><P x={17} y={26} c={BROWN} /><P x={18} y={26} c={BROWN} /><P x={19} y={26} c={BROWN} /><P x={20} y={26} c={BROWN} /><P x={21} y={26} c={BROWN_D} />

			{/* Sweat drops */}
			<motion.g animate={{ opacity: [0, 1, 0], y: [0, 2, 5] }} transition={{ duration: 1.2, repeat: Infinity }}>
				<P x={22} y={15} c={BLUE} /><P x={23} y={16} c={BLUE_D} />
			</motion.g>
			<motion.g animate={{ opacity: [0, 1, 0], y: [0, 3, 6] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}>
				<P x={15} y={17} c={BLUE} />
			</motion.g>
		</svg>
	);
}

function BeachGuy() {
	return (
		<svg viewBox="0 0 200 220" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
			{/* === SUN === */}
			<motion.g animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "170px 25px" }}>
				<P x={32} y={2} c={YELLOW} /><P x={33} y={2} c={YELLOW} /><P x={34} y={2} c={YELLOW} />
				<P x={31} y={3} c={YELLOW} /><P x={32} y={3} c={ORANGE} /><P x={33} y={3} c={YELLOW} /><P x={34} y={3} c={ORANGE} /><P x={35} y={3} c={YELLOW} />
				<P x={32} y={4} c={YELLOW} /><P x={33} y={4} c={YELLOW} /><P x={34} y={4} c={YELLOW} />
				{/* Rays */}
				<P x={33} y={1} c={YELLOW} /><P x={30} y={3} c={YELLOW} /><P x={36} y={3} c={YELLOW} /><P x={33} y={5} c={YELLOW} />
			</motion.g>

			{/* === PALM TREE === */}
			{/* Trunk */}
			<P x={5} y={18} c={TRUNK} /><P x={5} y={19} c={TRUNK} /><P x={5} y={20} c={TRUNK} /><P x={5} y={21} c={TRUNK} />
			<P x={5} y={22} c={TRUNK} /><P x={5} y={23} c={TRUNK} /><P x={5} y={24} c={TRUNK} /><P x={5} y={25} c={TRUNK} />
			<P x={6} y={17} c={TRUNK} /><P x={6} y={16} c={TRUNK} />
			{/* Leaves */}
			<P x={3} y={14} c={PALM} /><P x={4} y={14} c={PALM} /><P x={5} y={14} c={PALM_D} /><P x={6} y={14} c={PALM} /><P x={7} y={14} c={PALM} />
			<P x={2} y={13} c={PALM} /><P x={3} y={13} c={PALM_D} /><P x={7} y={13} c={PALM_D} /><P x={8} y={13} c={PALM} />
			<P x={4} y={15} c={PALM_D} /><P x={5} y={15} c={PALM} /><P x={6} y={15} c={PALM_D} /><P x={7} y={15} c={PALM} /><P x={8} y={15} c={PALM_D} /><P x={9} y={15} c={PALM} />
			<P x={1} y={14} c={PALM} /><P x={9} y={14} c={PALM} /><P x={10} y={15} c={PALM_D} />
			<P x={3} y={16} c={PALM_D} /><P x={8} y={16} c={PALM} /><P x={9} y={16} c={PALM_D} />

			{/* === WAVES === */}
			{[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
				<motion.g key={`w${i}`} animate={{ x: [0, 2, 0, -2, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.15 }}>
					<P x={i*3+1} y={34} c={BLUE} /><P x={i*3+2} y={34} c={BLUE_D} />
				</motion.g>
			))}
			{Array.from({length: 38}, (_,i) => <P key={`wa${i}`} x={1+i} y={35} c={BLUE_D} />)}

			{/* === SAND === */}
			{Array.from({length: 38}, (_,i) => <P key={`sa${i}`} x={1+i} y={33} c={SAND} />)}
			{Array.from({length: 38}, (_,i) => <P key={`sb${i}`} x={1+i} y={32} c={i%5===0 ? SAND_D : SAND} />)}

			{/* === LOUNGE CHAIR === */}
			{/* Chair back (angled) */}
			<P x={13} y={22} c={ORANGE} /><P x={14} y={23} c={ORANGE} /><P x={15} y={24} c={ORANGE} />
			{/* Chair seat */}
			<P x={16} y={25} c={ORANGE} /><P x={17} y={25} c={ORANGE} /><P x={18} y={25} c={ORANGE} /><P x={19} y={25} c={ORANGE} /><P x={20} y={25} c={ORANGE} /><P x={21} y={25} c={ORANGE} />
			{/* Chair legs */}
			<P x={14} y={26} c={ORANGE} /><P x={21} y={26} c={ORANGE} />
			<P x={14} y={27} c={BROWN} /><P x={21} y={27} c={BROWN} />

			{/* === CHARACTER — chill guy reclined === */}
			{/* Sunglasses / Head */}
			<P x={15} y={18} c={SKIN} /><P x={16} y={18} c={SKIN} /><P x={17} y={18} c={SKIN} /><P x={18} y={18} c={SKIN} /><P x={19} y={18} c={SKIN_S} />
			<P x={15} y={19} c={SKIN} /><P x={16} y={19} c={SKIN} /><P x={17} y={19} c={SKIN} /><P x={18} y={19} c={SKIN} /><P x={19} y={19} c={SKIN_S} />
			{/* Hair */}
			<P x={15} y={17} c={BLACK} /><P x={16} y={17} c={BLACK} /><P x={17} y={17} c={BLACK} /><P x={18} y={17} c={BLACK} /><P x={19} y={17} c={BLACK} />
			{/* Sunglasses */}
			<P x={15} y={19} c={BLACK} /><P x={16} y={19} c={"#202040"} /><P x={18} y={19} c={"#202040"} /><P x={19} y={19} c={BLACK} />
			{/* Mouth — smile */}
			<P x={16} y={20} c={SKIN} /><P x={17} y={20} c={SKIN_S} /><P x={18} y={20} c={SKIN} />

			{/* Body — tshirt + shorts, reclined */}
			<P x={16} y={21} c={TEAL} /><P x={17} y={21} c={TEAL} /><P x={18} y={21} c={TEAL} />
			<P x={16} y={22} c={TEAL} /><P x={17} y={22} c={TEAL} /><P x={18} y={22} c={TEAL} />
			<P x={17} y={23} c={PURPLE} /><P x={18} y={23} c={PURPLE} />
			{/* Legs stretched out */}
			<P x={19} y={23} c={SKIN} /><P x={20} y={23} c={SKIN} /><P x={21} y={24} c={SKIN} /><P x={22} y={24} c={SKIN_S} />

			{/* Arm holding coconut */}
			<motion.g animate={{ rotate: [0, -2, 0, 2, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "100px 115px" }}>
				<P x={19} y={21} c={SKIN} /><P x={20} y={20} c={SKIN} /><P x={21} y={20} c={SKIN_S} />
				{/* Coconut drink */}
				<P x={22} y={19} c={COCONUT} /><P x={23} y={19} c={COCONUT} />
				<P x={22} y={20} c={COCONUT} /><P x={23} y={20} c={COCONUT} />
				{/* Straw */}
				<P x={23} y={18} c={RED} /><P x={24} y={17} c={RED} />
				{/* Umbrella on drink */}
				<P x={24} y={18} c={YELLOW} /><P x={25} y={18} c={YELLOW} />
			</motion.g>

			{/* Other arm — behind head, relaxing */}
			<P x={14} y={21} c={SKIN} /><P x={13} y={20} c={SKIN} /><P x={14} y={20} c={SKIN_S} />

			{/* === LAPTOP on lap === */}
			<P x={17} y={24} c={"#404060"} /><P x={18} y={24} c={"#404060"} /><P x={19} y={24} c={"#404060"} />
			{/* Screen */}
			<P x={17} y={23} c={"#303050"} /><P x={18} y={23} c={PURPLE} s={5} />
		</svg>
	);
}

export function EditorComparison() {
	return (
		<div className="mx-auto max-w-4xl px-6">
			<div className="relative grid grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-white/[0.08]">
				{/* Left — Karate guy grinding */}
				<div className="relative bg-gradient-to-b from-red-950/50 to-[#0a0608] p-4 sm:p-6 border-r border-white/[0.06]">
					<div className="mx-auto max-w-[200px] sm:max-w-[240px]">
						<KarateGuy />
					</div>
					<div className="text-center mt-3">
						<p className="text-red-400 font-black font-[family-name:var(--font-display)] text-lg sm:text-2xl">20+ hrs</p>
						<p className="text-white/50 text-xs sm:text-sm mt-1 font-medium">&ldquo;You editing in Premiere&rdquo;</p>
					</div>
				</div>

				{/* Right — Beach chill guy */}
				<div className="relative bg-gradient-to-b from-cyan-950/40 via-violet-950/30 to-[#0a0610] p-4 sm:p-6">
					<div className="mx-auto max-w-[200px] sm:max-w-[240px]">
						<BeachGuy />
					</div>
					<div className="text-center mt-3">
						<p className="text-emerald-400 font-black font-[family-name:var(--font-display)] text-lg sm:text-2xl">10 mins</p>
						<p className="text-white/50 text-xs sm:text-sm mt-1 font-medium">&ldquo;You with VibeEdit&rdquo;</p>
					</div>
				</div>

				{/* VS divider */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<motion.div
						className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#08080c] border-2 border-white/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)]"
						animate={{ scale: [1, 1.1, 1] }}
						transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
					>
						<span className="text-white/70 font-black text-xs sm:text-sm font-[family-name:var(--font-display)]">VS</span>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
