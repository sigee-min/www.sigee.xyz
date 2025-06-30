import {
	AUTO_MODE,
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
} from "@constants/constants.ts";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

export function getDefaultHue(): number {
	const fallback = "250";
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback);
}

export function getHue(): number {
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored) : getDefaultHue();
}

export function setHue(hue: number): void {
	localStorage.setItem("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE) {
	let isDark = false;
	switch (theme) {
		case LIGHT_MODE:
			document.documentElement.classList.remove("dark");
			isDark = false;
			break;
		case DARK_MODE:
			document.documentElement.classList.add("dark");
			isDark = true;
			break;
		case AUTO_MODE:
			isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			if (isDark) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
			break;
	}

	// --- Giscus Theme Sync ---
	const giscusTheme = isDark ? "dark" : "light";

	// 이 메시지는 사용자가 Giscus가 로드된 *후에* 테마를 변경할 때를 위한 것입니다.
	// 초기 테마는 License.astro의 인라인 스크립트가 깜빡임 없이 설정합니다.
	const iframe = document.querySelector<HTMLIFrameElement>(
		"iframe.giscus-frame",
	);
	if (iframe?.contentWindow) {
		iframe.contentWindow.postMessage(
			{ giscus: { setConfig: { theme: giscusTheme } } },
			"https://giscus.app",
		);
	}

	// Set the theme for Expressive Code
	document.documentElement.setAttribute(
		"data-theme",
		expressiveCodeConfig.theme,
	);
}

export function setTheme(theme: LIGHT_DARK_MODE): void {
	localStorage.setItem("theme", theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}
