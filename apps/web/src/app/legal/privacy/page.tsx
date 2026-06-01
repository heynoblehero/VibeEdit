export default function Privacy() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Privacy Policy</h1>
      <p className="mb-8 text-sm text-[var(--color-fg-muted)]">
        Last updated: 2026-05-17 · Working draft.
      </p>

      <h2 className="mt-6 text-xl font-semibold">What we collect</h2>
      <ul className="ml-6 list-disc">
        <li>Account info: email + name you provide on signup.</li>
        <li>Compositions + assets you create or upload.</li>
        <li>Chat transcripts with the AI agent (to provide the Service).</li>
        <li>Render job metadata + the produced MP4 files.</li>
        <li>Stripe billing data (handled by Stripe; we never see card numbers).</li>
        <li>Anonymous error logs (when you opt in to telemetry).</li>
      </ul>

      <h2 className="mt-6 text-xl font-semibold">Where it lives</h2>
      <p>
        Data is stored in our cloud infrastructure. Compositions, renders, and assets are stored on
        encrypted disk and retained until you delete them or close your account.
      </p>

      <h2 className="mt-6 text-xl font-semibold">Third-party processors</h2>
      <ul className="ml-6 list-disc">
        <li>Anthropic (AI agent inference).</li>
        <li>Stripe (billing).</li>
        <li>Resend (transactional email).</li>
      </ul>
      <p>
        Each handles your data under their own privacy terms. We share only what is needed to
        operate the Service.
      </p>

      <h2 className="mt-6 text-xl font-semibold">Your rights</h2>
      <p>
        You can export or delete your data at any time from{" "}
        <a href="/app/settings/account" className="underline">
          settings
        </a>
        . Account deletion is irreversible and removes your compositions, renders, and chat history.
      </p>

      <h2 className="mt-6 text-xl font-semibold">Contact</h2>
      <p>privacy@vibeedit.video</p>
    </>
  );
}
