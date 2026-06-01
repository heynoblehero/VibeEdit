import { headers } from "next/headers";
import { auth } from "./auth";

export async function getServerSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

export async function requireServerSession() {
  const s = await getServerSession();
  if (!s) throw new Response("unauthorized", { status: 401 });
  return s;
}
