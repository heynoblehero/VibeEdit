import Link from "next/link";
import { notFound } from "next/navigation";
import { getHelpArticle, HELP_ARTICLES } from "@/lib/help-articles";
import { Wordmark } from "@/components/Wordmark";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-8 flex items-center justify-between sm:mb-10">
        <Link href="/">
          <Wordmark size="md" />
        </Link>
        <Link
          href="/help"
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          ← All articles
        </Link>
      </header>
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{article.title}</h1>
      <p className="mb-8 text-[var(--color-fg-muted)]">{article.summary}</p>
      <article className="prose prose-invert max-w-none whitespace-pre-wrap break-words leading-relaxed">
        {article.body}
      </article>
    </main>
  );
}
