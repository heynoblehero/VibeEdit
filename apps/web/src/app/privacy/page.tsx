export default function PrivacyPage() {
	return (
		<div className="min-h-screen bg-background py-16 px-4">
			<div className="max-w-3xl mx-auto">
				<h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
				<p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

				<div className="prose prose-sm max-w-none text-foreground/80 space-y-6">
					<section>
						<h2 className="text-lg font-semibold text-foreground">1. What We Collect</h2>
						<p>When you use VibeEdit, we collect the following information:</p>
						<ul className="list-disc pl-6 mt-2 space-y-1">
							<li>
								<strong>Account information:</strong> Email address, name, and profile image when you
								sign up
							</li>
							<li>
								<strong>Usage data:</strong> Features used, credit consumption, and project metadata
								(names, timestamps)
							</li>
							<li>
								<strong>Media files:</strong> Temporarily processed on our servers when you use AI
								features, then deleted after processing
							</li>
						</ul>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">2. How We Use Your Data</h2>
						<p>We use your information to:</p>
						<ul className="list-disc pl-6 mt-2 space-y-1">
							<li>Provide and maintain the VibeEdit service</li>
							<li>Process AI editing requests on your media</li>
							<li>Track credit balances and transaction history</li>
							<li>Send important service-related communications</li>
							<li>Improve the product and fix bugs</li>
						</ul>
						<p className="mt-2">
							We do not sell your personal data or use your content for training AI models.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">3. Third-Party Services</h2>
						<p>VibeEdit integrates with the following third-party services:</p>
						<ul className="list-disc pl-6 mt-2 space-y-1">
							<li>
								<strong>Polar:</strong> Payment processing for credit purchases
							</li>
							<li>
								<strong>ElevenLabs:</strong> Voice synthesis and audio generation
							</li>
							<li>
								<strong>Stability AI:</strong> Image generation
							</li>
							<li>
								<strong>Google OAuth:</strong> Optional sign-in provider
							</li>
						</ul>
						<p className="mt-2">
							Each provider has its own privacy policy. If you use your own API keys, your data is
							sent directly to those providers under your own agreement with them.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">4. Data Storage</h2>
						<p>
							Your account data, project metadata, and credit balances are stored in a SQLite database
							on our server. Media files uploaded for AI processing are stored temporarily and deleted
							after processing is complete. Project editing state is also stored in your browser's
							IndexedDB for offline access.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">5. Data Retention</h2>
						<p>
							We retain your account data for as long as your account is active. Media files submitted
							for AI processing are deleted immediately after processing. If you delete your account,
							all associated data (profile, projects, credit history) is permanently removed within 30
							days.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
						<p>You have the right to:</p>
						<ul className="list-disc pl-6 mt-2 space-y-1">
							<li>Access the personal data we hold about you</li>
							<li>Request correction of inaccurate data</li>
							<li>Request deletion of your account and all associated data</li>
							<li>Export your project data at any time</li>
							<li>Withdraw consent for optional data processing</li>
						</ul>
						<p className="mt-2">
							To exercise any of these rights, contact us at support@vibeedit.app.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">7. Cookies</h2>
						<p>
							VibeEdit uses essential cookies for authentication (session tokens). We do not use
							advertising or tracking cookies. Browser local storage and IndexedDB are used to persist
							your editor state and preferences locally.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">8. Children</h2>
						<p>
							VibeEdit is not intended for children under 13. We do not knowingly collect personal
							information from children under 13. If you believe a child under 13 has provided us with
							personal data, please contact us so we can delete it.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
						<p>
							We may update this privacy policy from time to time. We will notify you of material
							changes by posting the updated policy on this page with a revised date. Your continued
							use of VibeEdit after changes are posted constitutes your acceptance of the updated
							policy.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
						<p>
							If you have questions about this privacy policy or how we handle your data, please
							contact us at support@vibeedit.app.
						</p>
					</section>
				</div>

				<div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
					<a href="/" className="hover:text-foreground">
						&larr; Back to VibeEdit
					</a>
				</div>
			</div>
		</div>
	);
}
