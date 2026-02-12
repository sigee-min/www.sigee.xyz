import type { APIRoute } from "astro";
import { siteConfig } from "@/config";
import { getSortedPosts } from "@utils/content-utils";

const site = import.meta.env.SITE || "https://www.sigee.xyz";

function compactText(input: string): string {
	return input.replace(/\s+/g, " ").trim();
}

function stripMarkdown(input: string): string {
	return input
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!\[[^\]]*]\([^)]*\)/g, " ")
		.replace(/\[[^\]]*]\([^)]*\)/g, " ")
		.replace(/[#>*_~\-]+/g, " ");
}

function summarizeBody(body: string): string {
	const plain = compactText(stripMarkdown(body));
	if (plain.length <= 220) return plain;
	return `${plain.slice(0, 217)}...`;
}

export const GET: APIRoute = async () => {
	const posts = await getSortedPosts();

	const lines: string[] = [
		`# ${siteConfig.title}`,
		"",
		`${siteConfig.subtitle}`,
		"",
		`Site: ${site}`,
		`Language: ${siteConfig.lang}`,
		`Generated: ${new Date().toISOString()}`,
		"",
		"## Posts",
		"",
	];

	for (const post of posts) {
		const rawBody =
			typeof post.body === "string" ? post.body : String(post.body || "");
		const summary = post.data.description
			? compactText(post.data.description)
			: summarizeBody(rawBody);

		lines.push(`- Title: ${post.data.title}`);
		lines.push(`  URL: ${site}/posts/${post.slug}/`);
		lines.push(
			`  Published: ${post.data.published.toISOString().slice(0, 10)}`,
		);
		if (post.data.tags?.length) {
			lines.push(`  Tags: ${post.data.tags.join(", ")}`);
		}
		lines.push(`  Summary: ${summary || post.data.title}`);
		lines.push("");
	}

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
