import { NextResponse } from "next/server";
import { searchStock, type StockKind } from "@/lib/stock/registry";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const query = url.searchParams.get("q") || "";
	const kind = (url.searchParams.get("kind") as StockKind | null) || undefined;
	return NextResponse.json({ assets: searchStock(query, kind) });
}
