export default function Refunds() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Refund Policy</h1>
      <p className="mb-8 text-sm text-[var(--color-fg-muted)]">Last updated: 2026-05-17</p>
      <h2 className="mt-6 text-xl font-semibold">Trial</h2>
      <p>
        All paid plans include a 14-day $1 trial. Cancel before the trial ends and you are not
        charged again.
      </p>
      <h2 className="mt-6 text-xl font-semibold">After trial</h2>
      <p>
        Subscriptions are billed monthly. We offer a refund for the most recent month if you contact
        support within 14 days of the charge and the Service materially failed to function for you
        (renders never completed, account-locking bug, etc).
      </p>
      <h2 className="mt-6 text-xl font-semibold">How to request</h2>
      <p>
        Email{" "}
        <a className="underline" href="mailto:support@vibeedit.video">
          support@vibeedit.video
        </a>{" "}
        with your account email and the reason. We aim to respond within 2 business days.
      </p>
    </>
  );
}
