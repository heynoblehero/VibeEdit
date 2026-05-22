#!/usr/bin/env tsx
// Pre-launch readiness check. Verifies env, DB, CLI, templates, brand-kits dir.
// Exit non-zero on hard failures; warnings only print + return 0.

import { existsSync, statSync, readFileSync, accessSync, constants } from "node:fs";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

// Load .env.local (Next.js convention) — ESM-safe manual parse
for (const envFile of [".env.local", ".env"]) {
	const envPath = resolve(process.cwd(), envFile);
	if (!existsSync(envPath)) continue;
	const content = readFileSync(envPath, "utf8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
		if (!match) continue;
		const [, key, rawValue] = match;
		const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
		if (!process.env[key]) process.env[key] = value;
	}
}

type Result = "ok" | "warn" | "fail";
type Check = { name: string; result: Result; detail: string };
const checks: Check[] = [];

function color(result: Result, text: string): string {
	if (process.stdout.isTTY === false) return text;
	const ansi =
		result === "ok" ? "\x1b[32m" : result === "warn" ? "\x1b[33m" : "\x1b[31m";
	return `${ansi}${text}\x1b[0m`;
}

function record(name: string, result: Result, detail: string) {
	checks.push({ name, result, detail });
	const symbol = result === "ok" ? "✓" : result === "warn" ? "·" : "×";
	console.log(`  ${color(result, symbol)} ${name.padEnd(34)} ${detail}`);
}

console.log("\n▲ vibeedit-video preflight\n");

// 1. Env vars
const envRequired = ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
const envOptional: Array<[string, string]> = [
	["ANTHROPIC_API_KEY", "uses Claude Code OAuth (Agent SDK) when missing"],
	["STRIPE_SECRET_KEY", "billing falls back to dev mode (plan auto-flip)"],
	["STRIPE_PRICE_CREATOR", "needed for live $19/mo checkout"],
	["STRIPE_PRICE_STUDIO", "needed for live $49/mo checkout"],
	["STRIPE_WEBHOOK_SECRET", "needed to receive Stripe events"],
	["RESEND_API_KEY", "transactional emails fall back to console.log"],
	["SENTRY_DSN", "error tracking off until set"],
	["AWS_S3_BACKUP_BUCKET", "db backups stay local until set"],
];
for (const key of envRequired) {
	if (process.env[key]) record(`env: ${key}`, "ok", "set");
	else record(`env: ${key}`, "fail", "MISSING (required)");
}
for (const [key, hint] of envOptional) {
	if (process.env[key]) record(`env: ${key}`, "ok", "set");
	else record(`env: ${key}`, "warn", hint);
}

// 2. Database
const DB_PATH =
	process.env.DATABASE_PATH || resolve(process.cwd(), "storage", "app.db");
if (!existsSync(DB_PATH)) {
	record("database file", "fail", `not found at ${DB_PATH}`);
} else {
	try {
		const db = new Database(DB_PATH, { readonly: true });
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table'")
			.all() as Array<{ name: string }>;
		const required = [
			"user",
			"projects",
			"subscriptions",
			"usageEvents",
			"workerTokens",
			"brandKits",
		];
		const missing = required.filter((t) => !tables.some((row) => row.name === t));
		if (missing.length === 0) {
			record(
				"database tables",
				"ok",
				`${tables.length} tables, all required present`,
			);
		} else {
			record(
				"database tables",
				"fail",
				`missing: ${missing.join(", ")}`,
			);
		}
		db.close();
	} catch (error) {
		record("database tables", "fail", (error as Error).message);
	}
}

// 3. hyperframes CLI
const cliPath = resolve(process.cwd(), "node_modules", ".bin", "hyperframes");
if (existsSync(cliPath)) {
	record("hyperframes CLI", "ok", "installed in node_modules/.bin");
} else {
	record("hyperframes CLI", "fail", "missing — bun install");
}

// 4. Templates
const templatesRoot = resolve(process.cwd(), "templates");
const registryPath = join(templatesRoot, "_registry.json");
if (existsSync(registryPath)) {
	try {
		const reg = JSON.parse(readFileSync(registryPath, "utf8")) as {
			templates: Array<{ slug: string }>;
		};
		const present = reg.templates.filter((t) =>
			existsSync(join(templatesRoot, t.slug, "index.html")),
		).length;
		if (present === reg.templates.length) {
			record(
				"templates",
				"ok",
				`${present} / ${reg.templates.length} present`,
			);
		} else {
			record(
				"templates",
				"warn",
				`only ${present} / ${reg.templates.length} have index.html`,
			);
		}
	} catch (error) {
		record("templates", "fail", (error as Error).message);
	}
} else {
	record("templates", "fail", "_registry.json missing");
}

// 5. Lint one template as a smoke test
await new Promise<void>((resolveP) => {
	const child = spawn(
		"hyperframes",
		["lint", "templates/comic-facts-16x9"],
		{
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH || ""}`,
			},
		},
	);
	let out = "";
	child.stdout.on("data", (b: Buffer) => {
		out += b.toString();
	});
	child.stderr.on("data", (b: Buffer) => {
		out += b.toString();
	});
	child.on("error", () => {
		record("template lint", "fail", "could not spawn hyperframes");
		resolveP();
	});
	child.on("exit", (code) => {
		if (code === 0) {
			record("template lint", "ok", "comic-facts-16x9 passes");
		} else {
			record(
				"template lint",
				"warn",
				`exit ${code}: ${out.split("\n").pop()?.trim()}`,
			);
		}
		resolveP();
	});
});

// 6. Storage dirs writable
const STORAGE_ROOT =
	process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");
const expected = ["projects", "renders", "brand-kits", "backups"];
for (const sub of expected) {
	const dir = join(STORAGE_ROOT, sub);
	try {
		if (!existsSync(dir)) record(`storage/${sub}`, "warn", "will be created on demand");
		else if (statSync(dir).isDirectory()) {
			try {
				accessSync(dir, constants.W_OK);
				record(`storage/${sub}`, "ok", "writable");
			} catch {
				record(`storage/${sub}`, "fail", "not writable");
			}
		}
	} catch (error) {
		record(`storage/${sub}`, "fail", (error as Error).message);
	}
}

// 7. Marketing assets
for (const f of ["public/favicon.svg", "public/logo.svg", "public/og-default.svg"]) {
	const full = resolve(process.cwd(), f);
	if (existsSync(full)) record(f, "ok", `${statSync(full).size}B`);
	else record(f, "warn", "missing — generate before launch");
}

const demoMp4 = resolve(process.cwd(), "public", "demo.mp4");
if (existsSync(demoMp4))
	record(
		"public/demo.mp4",
		"ok",
		`${Math.round(statSync(demoMp4).size / 1024)}KB`,
	);
else record("public/demo.mp4", "warn", "no demo video yet — record before PH launch");

// Summary
console.log();
const failures = checks.filter((c) => c.result === "fail").length;
const warnings = checks.filter((c) => c.result === "warn").length;
const oks = checks.filter((c) => c.result === "ok").length;
console.log(
	`▲ ${color("ok", `${oks} ok`)} · ${color("warn", `${warnings} warn`)} · ${color("fail", `${failures} fail`)}`,
);
if (failures > 0) {
	console.log(color("fail", "\nNOT ready to launch. Fix failures above.\n"));
	process.exit(1);
}
if (warnings > 0) {
	console.log(
		color("warn", "\nLaunch possible, but address warnings before PH day.\n"),
	);
	process.exit(0);
}
console.log(color("ok", "\nAll systems go. Ship it.\n"));
process.exit(0);
