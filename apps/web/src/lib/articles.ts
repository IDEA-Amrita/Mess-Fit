// Server-only article loader. Reads markdown from src/content/articles at
// build/request time with gray-matter. Never import this from a client
// component — it uses the Node fs module.

import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface ArticleMeta {
  slug: string;
  title: string;
  description: string;
  author: string;
  published: string;
  reading_time_min: number;
  tags: string[];
}

export interface Article extends ArticleMeta {
  content: string;
}

const ARTICLES_DIR = path.join(process.cwd(), "src", "content", "articles");

function parseFile(filename: string): Article {
  const raw = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf-8");
  const { data, content } = matter(raw);
  const slug = String(data.slug ?? filename.replace(/\.md$/, ""));
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    author: String(data.author ?? "messfit"),
    published: String(data.published ?? ""),
    reading_time_min: Number(data.reading_time_min ?? 5),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content,
  };
}

export function getAllArticles(): Article[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parseFile)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getArticle(slug: string): Article | undefined {
  return getAllArticles().find((a) => a.slug === slug);
}

export function relatedByTag(slug: string, limit = 3): ArticleMeta[] {
  const current = getArticle(slug);
  if (!current) return [];
  const tagset = new Set(current.tags);
  return getAllArticles()
    .filter((a) => a.slug !== slug)
    .map((a) => ({
      article: a,
      overlap: a.tags.filter((t) => tagset.has(t)).length,
    }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map(({ article }) => stripContent(article));
}

function stripContent(a: Article): ArticleMeta {
  const { content: _content, ...meta } = a;
  void _content;
  return meta;
}
