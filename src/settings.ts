import { App, PluginSettingTab, Setting } from "obsidian";
import type KindleHtmlToMdPlugin from "./main";

export interface KindleHtmlToMdSettings {
	outputFolder: string;
	tag: string;
}

export const DEFAULT_SETTINGS: KindleHtmlToMdSettings = {
	outputFolder: "study/book",
	tag: "#study/book",
};

export class KindleHtmlToMdSettingTab extends PluginSettingTab {
	plugin: KindleHtmlToMdPlugin;

	constructor(app: App, plugin: KindleHtmlToMdPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Folder path within the vault where converted MD files will be saved.")
			.addText((text) =>
				text
					.setPlaceholder("study/book")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Tag")
			.setDesc("Obsidian tag to add to each converted note (e.g. #study/book).")
			.addText((text) =>
				text
					.setPlaceholder("#study/book")
					.setValue(this.plugin.settings.tag)
					.onChange(async (value) => {
						this.plugin.settings.tag = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
