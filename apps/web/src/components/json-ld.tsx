import { SITE_URL } from "@/constants/site-constants";

export function OrganizationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "VibeEdit",
		url: SITE_URL,
		logo: `${SITE_URL}/logos/opencut/svg/logo.svg`,
		sameAs: [
			"https://x.com/vibevideoedit",
			"https://github.com/heynoblehero/VibeEdit",
		],
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}

export function SoftwareApplicationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "VibeEdit",
		applicationCategory: "MultimediaApplication",
		operatingSystem: "Web",
		url: SITE_URL,
		description: "Edit videos by talking to AI. Drop your files, describe the edit, get a finished video in minutes.",
		offers: {
			"@type": "AggregateOffer",
			lowPrice: "19",
			highPrice: "99",
			priceCurrency: "USD",
			offerCount: "3",
		},
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}

export function FAQJsonLd({ items }: { items: { q: string; a: string }[] }) {
	const data = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.q,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.a,
			},
		})),
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}
