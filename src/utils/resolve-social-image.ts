import path from "node:path";

interface ResolveSocialImageOptions {
	source?: string;
	baseDir?: string;
	fallback: string;
}

const localImageFiles = import.meta.glob(
	[
		"../**/*.png",
		"../**/*.jpg",
		"../**/*.jpeg",
		"../**/*.gif",
		"../**/*.webp",
		"../**/*.avif",
		"../**/*.svg",
	],
	{ import: "default" },
);

export async function resolveSocialImage({
	source,
	baseDir = "",
	fallback,
}: ResolveSocialImageOptions): Promise<string> {
	if (!source) return fallback;
	if (
		source.startsWith("/") ||
		source.startsWith("http://") ||
		source.startsWith("https://")
	) {
		return source;
	}

	const resolvedSource = baseDir ? path.join(baseDir, source) : source;
	const normalizedPath = path
		.normalize(path.join("../", resolvedSource))
		.replace(/\\/g, "/");
	const file = localImageFiles[normalizedPath];

	if (!file) {
		console.error(
			`[ERROR] Social image file not found: ${normalizedPath.replace("../", "src/")}`,
		);
		return fallback;
	}

	const image = await file();
	if (typeof image === "string") return image;
	if (image && typeof image === "object" && "src" in image) {
		return image.src as string;
	}
	return fallback;
}
