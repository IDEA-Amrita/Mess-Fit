import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllArticles, getArticle, relatedByTag } from "@/lib/articles";
import { ArticleReader } from "@/components/learn/ArticleReader";

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Not found — MessFit" };
  return {
    title: `${article.title} — MessFit`,
    description: article.description,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = relatedByTag(slug);
  return <ArticleReader article={article} related={related} />;
}
