// Regex to extract noteHeading + noteText pairs from the malformed Kindle HTML.
// The HTML has <h3 class='noteHeading'>...</div><div class='noteText'>...</div> (or </h3>)
const NOTE_PAIR_RE =
	/<h3 class='noteHeading'>(.*?)<\/div>\s*<div class='noteText'>(.*?)<\/(?:div|h3)>/gs;

// CJK characters: kanji, hiragana, katakana, fullwidth forms, CJK punctuation
const CJK =
	"[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uff00-\uffef]";

const CJK_BEFORE = new RegExp(`(${CJK}) `, "g");
const CJK_AFTER = new RegExp(` (${CJK})`, "g");

export interface HighlightEntry {
	type: "highlight";
	text: string;
	location: string;
	ref: string;
	memo: string | null;
}

/**
 * Remove spurious spaces inserted by Kindle export.
 */
function cleanKindleSpaces(text: string): string {
	// Remove space when the character before OR after is CJK
	text = text.replace(CJK_BEFORE, "$1");
	text = text.replace(CJK_AFTER, "$1");
	// Remove space after ( and before )
	text = text.replace(/\( /g, "(");
	text = text.replace(/ \)/g, ")");
	// Remove space after /
	text = text.replace(/\/ /g, "/");
	// Escape [ and ] to prevent Obsidian link interpretation
	text = text.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
	// Escape # to prevent Obsidian heading interpretation
	text = text.replace(/#/g, "\\#");
	return text;
}

/**
 * Strip HTML tags from a string, returning plain text.
 */
function stripTags(html: string): string {
	return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * Parse Kindle HTML and extract title, author, and highlight entries.
 */
export function parseHtml(html: string): {
	title: string;
	author: string;
	entries: HighlightEntry[];
} {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Extract title (remove 『』)
	const titleDiv = doc.querySelector(".bookTitle");
	let title = titleDiv ? titleDiv.textContent?.trim() ?? "" : "";
	title = title.replace(/^『/, "").replace(/』$/, "");

	// Extract author (remove （）and 著)
	const authorDiv = doc.querySelector(".authors");
	let author = authorDiv ? authorDiv.textContent?.trim() ?? "" : "";
	author = author.replace(/^[（(]/, "");
	author = author.replace(/[）)]$/, "");
	author = author.replace(/著$/, "");

	// Parse highlights and memos using regex (HTML is malformed)
	const entries: HighlightEntry[] = [];
	let match: RegExpExecArray | null;

	// Reset lastIndex since we reuse the regex
	NOTE_PAIR_RE.lastIndex = 0;
	while ((match = NOTE_PAIR_RE.exec(html)) !== null) {
		const headingHtml = match[1];
		let noteText = match[2].trim();

		const headingText = stripTags(headingHtml);
		noteText = cleanKindleSpaces(noteText);

		// Skip empty highlights
		if (!noteText) continue;

		// Extract location number
		const locMatch = headingText.match(/位置No\.\s*(\d+)/);
		const location = locMatch ? locMatch[1] : "";

		if (headingText.startsWith("ハイライト")) {
			const refId = String(Math.floor(Math.random() * 90000) + 10000);
			entries.push({
				type: "highlight",
				text: noteText,
				location,
				ref: refId,
				memo: null,
			});
		} else if (headingText.startsWith("メモ")) {
			// Attach memo to the previous highlight
			if (entries.length > 0 && entries[entries.length - 1].type === "highlight") {
				entries[entries.length - 1].memo = noteText;
			}
		}
	}

	return { title, author, entries };
}

/**
 * Build the ## Highlights section.
 */
function buildHighlights(entries: HighlightEntry[]): string {
	const lines: string[] = [];
	lines.push("## Highlights");
	for (const entry of entries) {
		lines.push(
			`${entry.text} — location: ${entry.location} ^ref-${entry.ref}`
		);
		lines.push("");
		if (entry.memo) {
			lines.push(entry.memo);
			lines.push("");
		}
		lines.push("---");
	}
	return lines.join("\n") + "\n";
}

/**
 * Build frontmatter block.
 */
function buildFrontmatter(
	title: string,
	author: string,
	highlightsCount: number
): string {
	return [
		"---",
		`title: ${title}`,
		`author: ${author}`,
		`highlightsCount: ${highlightsCount}`,
		"---",
	].join("\n");
}

/**
 * Build a full new Markdown file (no existing file).
 */
export function buildNewMarkdown(
	title: string,
	author: string,
	entries: HighlightEntry[],
	tag: string
): string {
	return [
		buildFrontmatter(title, author, entries.length),
		tag,
		`# ${title}`,
		"## Metadata",
		`* Author: ${author}`,
		"",
		buildHighlights(entries),
	].join("\n");
}

/**
 * Find the range of a ## heading section: from the heading line
 * to the line before the next ## heading (or EOF).
 * Returns [start, end) indices, or null if not found.
 */
function findSectionRange(
	lines: string[],
	heading: string
): [number, number] | null {
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (start === -1) {
			if (lines[i].trim() === heading) {
				start = i;
			}
		} else {
			// Next ## heading marks end of this section
			if (/^## /.test(lines[i])) {
				return [start, i];
			}
		}
	}
	// Section runs to EOF
	if (start !== -1) return [start, lines.length];
	return null;
}

/**
 * Merge into an existing file. Touches only:
 *   1. Frontmatter (---...---) — overwrite
 *   2. ## Metadata section (up to next ##) — overwrite
 *   3. ## Highlights section (up to next ## or EOF) — overwrite
 * Everything else (tag, title, user sections) is preserved.
 */
export function mergeWithExisting(
	existingMd: string,
	title: string,
	author: string,
	entries: HighlightEntry[]
): string {
	let lines = existingMd.split("\n");

	// --- 1. Replace frontmatter ---
	let fmStart = -1;
	let fmEnd = -1;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			if (fmStart === -1) {
				fmStart = i;
			} else {
				fmEnd = i;
				break;
			}
		}
	}

	if (fmStart !== -1 && fmEnd !== -1) {
		const newFm = buildFrontmatter(title, author, entries.length).split("\n");
		lines.splice(fmStart, fmEnd - fmStart + 1, ...newFm);
	}

	// --- 2. Replace ## Highlights section ---
	// (do Highlights first so indices for Metadata stay valid)
	const hlRange = findSectionRange(lines, "## Highlights");
	const newHl = buildHighlights(entries).replace(/\n$/, "").split("\n");
	if (hlRange) {
		lines.splice(hlRange[0], hlRange[1] - hlRange[0], ...newHl);
	} else {
		lines.push(...newHl);
	}

	// --- 3. Replace ## Metadata section ---
	const mdRange = findSectionRange(lines, "## Metadata");
	const newMd = ["## Metadata", `* Author: ${author}`, ""];
	if (mdRange) {
		lines.splice(mdRange[0], mdRange[1] - mdRange[0], ...newMd);
	} else {
		// Insert before ## Highlights if present, otherwise append
		const hlIdx = lines.findIndex((l) => l.trim() === "## Highlights");
		if (hlIdx !== -1) {
			lines.splice(hlIdx, 0, ...newMd);
		} else {
			lines.push(...newMd);
		}
	}

	return lines.join("\n").replace(/\n*$/, "\n");
}
