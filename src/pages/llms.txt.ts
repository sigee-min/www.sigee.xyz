import type { APIRoute } from "astro";
import { profileConfig, siteConfig } from "@/config";

const site = import.meta.env.SITE || "https://www.sigee.xyz";

const llmsTxt = `
# ${siteConfig.title}

${siteConfig.subtitle}

Owner: ${profileConfig.name}
Homepage: ${site}
RSS: ${site}/rss.xml
Sitemap: ${site}/sitemap-index.xml
Full index for LLMs: ${site}/llms-full.txt
`.trim();

export const GET: APIRoute = () => {
	return new Response(llmsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
