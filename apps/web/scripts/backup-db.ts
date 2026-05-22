#!/usr/bin/env tsx
// Daily SQLite backup. Hot-copies the DB via the better-sqlite3 backup API,
// gzips, and (optionally) uploads to S3 if AWS env vars are present.
//
// Cron suggestion: 0 3 * * * cd /path/to/apps/web && bun run scripts/backup-db.ts

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

const DB_PATH =
	process.env.DATABASE_PATH || resolve(process.cwd(), "storage", "app.db");
const BACKUP_DIR =
	process.env.BACKUP_DIR || resolve(process.cwd(), "storage", "backups");

mkdirSync(BACKUP_DIR, { recursive: true });

if (!existsSync(DB_PATH)) {
	console.error(`[backup] db not found at ${DB_PATH}`);
	process.exit(1);
}

const stamp = new Date()
	.toISOString()
	.replace(/[^0-9]/g, "")
	.slice(0, 14);
const snapshotPath = join(BACKUP_DIR, `app-${stamp}.db`);
const gzPath = `${snapshotPath}.gz`;

console.log(`[backup] snapshotting → ${snapshotPath}`);
const sqlite = new Database(DB_PATH, { readonly: true });
await sqlite.backup(snapshotPath);
sqlite.close();

const raw = readFileSync(snapshotPath);
const gz = gzipSync(raw);
import("node:fs").then(({ writeFileSync, unlinkSync }) => {
	writeFileSync(gzPath, gz);
	unlinkSync(snapshotPath);
	const sizeKb = Math.round(statSync(gzPath).size / 1024);
	console.log(`[backup] wrote ${gzPath} (${sizeKb}KB)`);

	if (process.env.AWS_S3_BACKUP_BUCKET) {
		const bucket = process.env.AWS_S3_BACKUP_BUCKET;
		const key = `backups/app-${stamp}.db.gz`;
		console.log(`[backup] uploading to s3://${bucket}/${key}`);
		const child = spawn(
			"aws",
			["s3", "cp", gzPath, `s3://${bucket}/${key}`, "--quiet"],
			{ stdio: "inherit" },
		);
		child.on("exit", (code) => {
			if (code === 0) console.log("[backup] s3 upload ok");
			else console.error(`[backup] s3 upload failed (${code})`);
		});
	} else {
		console.log("[backup] AWS_S3_BACKUP_BUCKET not set — local copy only");
	}

	// Prune: keep last 14 local snapshots
	import("node:fs").then(({ readdirSync, statSync, unlinkSync: rm }) => {
		const files = readdirSync(BACKUP_DIR)
			.filter((f) => f.endsWith(".db.gz"))
			.map((f) => ({
				name: f,
				mtime: statSync(join(BACKUP_DIR, f)).mtimeMs,
			}))
			.sort((a, b) => b.mtime - a.mtime);
		for (const f of files.slice(14)) {
			rm(join(BACKUP_DIR, f.name));
		}
	});
});
