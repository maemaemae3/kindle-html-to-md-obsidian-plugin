import { Notice, Plugin } from "obsidian";
import {
	KindleHtmlToMdSettings,
	DEFAULT_SETTINGS,
	KindleHtmlToMdSettingTab,
} from "./settings";
import { parseHtml, buildNewMarkdown, mergeWithExisting } from "./converter";

export default class KindleHtmlToMdPlugin extends Plugin {
	settings: KindleHtmlToMdSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Ribbon icon
		this.addRibbonIcon("book-open", "Import kindle HTML", () => {
			this.importKindleHtml();
		});

		// Command palette
		this.addCommand({
			id: "import-kindle-html",
			name: "Import kindle HTML",
			callback: () => {
				this.importKindleHtml();
			},
		});

		this.addSettingTab(new KindleHtmlToMdSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<KindleHtmlToMdSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Open a file picker, read selected HTML files, convert, and write MD to vault.
	 */
	private importKindleHtml() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".html";
		input.multiple = true;

		input.onchange = async () => {
			const files = input.files;
			if (!files || files.length === 0) return;

			let successCount = 0;
			let errorCount = 0;

			for (let i = 0; i < files.length; i++) {
				try {
					const htmlText = await this.readFileAsText(files[i]);
					await this.convertAndSave(htmlText);
					successCount++;
				} catch (e) {
					errorCount++;
					console.error(
						`Failed to convert ${files[i].name}:`,
						e
					);
				}
			}

			if (errorCount === 0) {
				new Notice(
					`Imported ${successCount} Kindle highlight${successCount !== 1 ? "s" : ""}.`
				);
			} else {
				new Notice(
					`Imported ${successCount}, failed ${errorCount}. Check console for details.`
				);
			}
		};

		input.click();
	}

	private readFileAsText(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
			reader.readAsText(file, "utf-8");
		});
	}

	private async convertAndSave(html: string) {
		const { title, author, entries } = parseHtml(html);

		if (!title) {
			throw new Error("Could not extract title from HTML");
		}

		const outputFolder = this.settings.outputFolder;
		const filePath = `${outputFolder}/${title}.md`;

		// Ensure output folder exists
		await this.ensureFolder(outputFolder);

		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		let md: string;
		if (existingFile) {
			// Existing file: only replace ## Metadata and ## Highlights
			const existingMd = await this.app.vault.read(
				existingFile as import("obsidian").TFile
			);
			md = mergeWithExisting(existingMd, title, author, entries);
			await this.app.vault.modify(
				existingFile as import("obsidian").TFile,
				md
			);
		} else {
			// New file: generate full markdown
			md = buildNewMarkdown(title, author, entries, this.settings.tag);
			await this.app.vault.create(filePath, md);
		}
	}

	/**
	 * Recursively create folders if they don't exist.
	 */
	private async ensureFolder(path: string) {
		if (this.app.vault.getAbstractFileByPath(path)) return;

		const parts = path.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
