import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
});

export { polar };

export function getCheckoutUrl(packId: string, userId: string): string {
  // In production, create a checkout session via Polar API
  // For now, return a placeholder
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  return `${baseUrl}/api/webhooks/polar/checkout?pack=${packId}&userId=${userId}`;
}
