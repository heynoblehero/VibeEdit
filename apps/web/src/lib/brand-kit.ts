import { eq } from "drizzle-orm";
import { db } from "./db";
import { brandKits } from "./db/schema";

export type BrandKitData = {
	logoPath: string | null;
	primaryColor: string | null;
	accentColor: string | null;
	fontFamily: string | null;
	watermarkPath: string | null;
	channelName: string | null;
	hostName: string | null;
	hostDescription: string | null;
};

const EMPTY: BrandKitData = {
	logoPath: null,
	primaryColor: null,
	accentColor: null,
	fontFamily: null,
	watermarkPath: null,
	channelName: null,
	hostName: null,
	hostDescription: null,
};

export async function readBrandKit(userId: string): Promise<BrandKitData> {
	const row = db
		.select()
		.from(brandKits)
		.where(eq(brandKits.userId, userId))
		.get();
	if (!row) return EMPTY;
	return {
		logoPath: row.logoPath,
		primaryColor: row.primaryColor,
		accentColor: row.accentColor,
		fontFamily: row.fontFamily,
		watermarkPath: row.watermarkPath,
		channelName: row.channelName,
		hostName: row.hostName,
		hostDescription: row.hostDescription,
	};
}

export function writeBrandKit(userId: string, patch: Partial<BrandKitData>) {
	const existing = db
		.select()
		.from(brandKits)
		.where(eq(brandKits.userId, userId))
		.get();
	const now = new Date();
	if (existing) {
		db.update(brandKits)
			.set({ ...patch, updatedAt: now })
			.where(eq(brandKits.userId, userId))
			.run();
	} else {
		db.insert(brandKits)
			.values({
				userId,
				logoPath: patch.logoPath ?? null,
				primaryColor: patch.primaryColor ?? null,
				accentColor: patch.accentColor ?? null,
				fontFamily: patch.fontFamily ?? null,
				watermarkPath: patch.watermarkPath ?? null,
				channelName: patch.channelName ?? null,
				hostName: patch.hostName ?? null,
				hostDescription: patch.hostDescription ?? null,
				updatedAt: now,
			})
			.run();
	}
}
