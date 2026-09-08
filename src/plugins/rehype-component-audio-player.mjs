import { h } from "hastscript";

/** Reusable Markdown player: ::audio-player{src="/audio/song.mp3" title="Song"} */
export function AudioPlayerComponent({ src, title = "오디오" }) {
	if (typeof src !== "string" || !/^(\/[^/]|https?:\/\/)/.test(src)) {
		throw new Error("audio-player requires a site-relative or HTTP(S) src.");
	}

	return h("figure", { className: "audio-player not-prose" }, [
		h("figcaption", { className: "audio-player-caption" }, [
			h("strong", { className: "audio-player-title" }, title),
		]),
		h("audio", { controls: true, preload: "none", src, ariaLabel: title }),
	]);
}
