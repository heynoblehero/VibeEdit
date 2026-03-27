export default function TermsPage() {
	return (
		<div className="min-h-screen bg-background py-16 px-4">
			<div className="max-w-3xl mx-auto">
				<h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
				<p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

				<div className="prose prose-sm max-w-none text-foreground/80 space-y-6">
					<section>
						<h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
						<p>
							By accessing or using VibeEdit, you agree to be bound by these Terms of Service. If you
							do not agree to these terms, do not use the service.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">2. Accounts</h2>
						<p>
							You must provide accurate information when creating an account. You are responsible for
							maintaining the security of your account credentials and for all activity under your
							account. You must be at least 13 years old to use VibeEdit.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">3. Credits & Payments</h2>
						<p>
							VibeEdit uses a credit-based system. Credits are purchased in advance and consumed when
							you use AI features such as sending messages, generating media, or rendering videos.
							Credits do not expire. All purchases are final and non-refundable unless required by
							applicable law. Payments are processed by Polar.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">4. Content Ownership</h2>
						<p>
							You retain full ownership of all content you upload, create, or export using VibeEdit.
							We do not claim any intellectual property rights over your content. By using the service,
							you grant us a limited license to process your content solely for the purpose of
							providing the editing features you request.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">5. Acceptable Use</h2>
						<p>You agree not to:</p>
						<ul className="list-disc pl-6 mt-2 space-y-1">
							<li>Use VibeEdit for any illegal purpose or to violate any laws</li>
							<li>Upload content that infringes on the rights of others</li>
							<li>Attempt to gain unauthorized access to the service or its systems</li>
							<li>Use the service to generate harmful, abusive, or deceptive content</li>
							<li>Resell or redistribute credits or access to the service</li>
							<li>Interfere with or disrupt the service or its infrastructure</li>
						</ul>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">6. AI-Generated Content</h2>
						<p>
							VibeEdit uses AI models to assist with video editing. AI-generated outputs may not
							always be accurate, appropriate, or free of errors. You are solely responsible for
							reviewing and using any AI-generated content. We do not guarantee the quality, accuracy,
							or suitability of AI outputs.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">7. Third-Party Services</h2>
						<p>
							VibeEdit integrates with third-party services including ElevenLabs (voice and audio),
							Stability AI (image generation), and Polar (payments). Your use of these integrations is
							subject to each provider's own terms and privacy policies. If you supply your own API
							keys, your usage is governed directly by your agreement with those providers.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">8. Termination</h2>
						<p>
							You may stop using VibeEdit and delete your account at any time. We may suspend or
							terminate your access if you violate these terms. Upon termination, your right to use
							the service ceases immediately, but you retain ownership of any content you have already
							exported.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">9. Disclaimer of Warranties</h2>
						<p>
							VibeEdit is provided "as is" and "as available" without warranties of any kind, whether
							express or implied. We do not warrant that the service will be uninterrupted, secure, or
							error-free. We disclaim all warranties including implied warranties of merchantability,
							fitness for a particular purpose, and non-infringement.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">10. Limitation of Liability</h2>
						<p>
							To the maximum extent permitted by law, VibeEdit and its operators shall not be liable
							for any indirect, incidental, special, consequential, or punitive damages, or any loss
							of profits, data, or goodwill arising from your use of the service. Our total liability
							shall not exceed the amount you paid to us in the 12 months preceding the claim.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">11. Changes to Terms</h2>
						<p>
							We may update these terms from time to time. We will notify you of material changes by
							posting the updated terms on this page with a revised date. Your continued use of
							VibeEdit after changes are posted constitutes your acceptance of the updated terms.
						</p>
					</section>

					<section>
						<h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
						<p>
							If you have questions about these terms, please contact us at support@vibeedit.app.
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
