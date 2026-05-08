import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

interface CodeBlockInserterSettings {
	lastUsedLanguage: string;
	additionalLanguages: string;
}

const DEFAULT_SETTINGS: CodeBlockInserterSettings = {
	lastUsedLanguage: "",
	additionalLanguages: "",
};

export default class CodeBlockInserterPlugin extends Plugin {
	suggester!: LanguageSuggester;
	settings!: CodeBlockInserterSettings;

	async onload() {
		await this.loadSettings();

		//Init and register LanguageSuggester

		this.suggester = new LanguageSuggester(this);
		this.registerEditorSuggest(this.suggester);

		this.addCommand({
			id: "insert-code-block-custom",
			name: "Insert code block",
			editorCallback: (editor: Editor) => {
				const cursor = editor.getCursor();
				const selection = editor.getSelection();
				// wrap selected text
				if (selection && selection.length > 0) {
					editor.replaceSelection(
						`\\\`\\\`\\\`\n${selection}\n\\\`\\\`\\\``,
					);
					return;
				}

				editor.replaceRange("```\n\n```", cursor);
				editor.setCursor({
					line: cursor.line,
					ch: cursor.ch + 3,
				});
			},
		});
		this.addSettingTab(new CodeBlockInserterSettingTab(this.app, this));
	}
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class LanguageSuggester extends EditorSuggest<string> {
	plugin: CodeBlockInserterPlugin;
	languages: string[];

	constructor(plugin: CodeBlockInserterPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.languages = [];
		this.updateLanguages();
	}
	updateLanguages() {
		const baseLanguages = [
			"javascript",
			"typescript",
			"python",
			"java",
			"c",
			"c++",
			"c#",
			"cpp",
			"csharp",
			"ruby",
			"go",
			"rust",
			"swift",
			"kotlin",
			"php",
			"html",
			"css",
			"sql",
			"bat",
			"batch",
			"bash",
			"powershell",
			"ps1",
			"markdown",
			"json",
			"yaml",
			"xml",
			"ocaml",
			"vue",
			"react",
			"tsx",
			"jsx",
			"shell",
			"dockerfile",
			"nginx",
			"mermaid",
			"toml",
			"ini",
			"plain",
			"text",
			"objective-c",
		];

		const additionalLanguages = this.plugin.settings.additionalLanguages
			.split(",")
			.map((lang) => lang.trim().toLowerCase())
			.filter((lang) => lang.length > 0);

		this.languages = Array.from(
			new Set([...additionalLanguages, ...baseLanguages]),
		).sort();
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile,
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const match = line.match(/```([^\s`]*)$/);

		if (match) {
			return {
				start: { line: cursor.line, ch: cursor.ch - match[1].length },
				end: cursor,
				query: match[1],
			};
		}
		return null;
	}

	getSuggestions(
		context: EditorSuggestContext,
	): string[] | Promise<string[]> {
		const query = context.query.toLowerCase();
		let suggestions = this.languages.filter((lang) =>
			lang.startsWith(query) || lang.includes(query),
		);
		// Prioritize last used language

		const lastUsedLanguage = this.plugin.settings.lastUsedLanguage;
		if (
			lastUsedLanguage &&
			lastUsedLanguage.startsWith(query) &&
			suggestions.includes(lastUsedLanguage)
		) {
			// move to top
			suggestions = [
				lastUsedLanguage,
				...suggestions.filter((lang) => lang !== lastUsedLanguage),
			];
		}

		return suggestions;
	}

	renderSuggestion(lang: string, el: HTMLElement): void {
		// el.setText(lang);
		el.createDiv({
			text: lang,
			cls: "code-block-language-suggestion",
		});
	}

	async selectSuggestion(lang: string, evt: MouseEvent | KeyboardEvent): Promise<void> {
		const { editor, start, end } = this.context!;
		const nextLine = editor.getLine(start.line + 1);
		const isCodeEnd = nextLine.trim().startsWith("```");
		editor.replaceRange(
			isCodeEnd ? lang + "\n" + nextLine.replace("```", "") : lang,
			start,
			end
		);

		editor.setCursor({
			line: end.line + 1,
			ch: editor.getLine(start.line + 1).length,
		});

		// update last used language
		this.plugin.settings.lastUsedLanguage = lang;
		await this.plugin.saveSettings();
	}
}

class CodeBlockInserterSettingTab extends PluginSettingTab {
	plugin: CodeBlockInserterPlugin;

	constructor(app: App, plugin: CodeBlockInserterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Last used language")
			.setDesc("The last programming language you used in a code block.")
			.addText((text) =>
				text
					.setPlaceholder("No language selected yet")
					.setValue(this.plugin.settings.lastUsedLanguage)
					.onChange(async (value) => {
						this.plugin.settings.lastUsedLanguage = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Additional languages")
			.setDesc("Add more languages (comma-separated).")
			.addTextArea((text) =>
				text
					.setPlaceholder("e.g., ruby, lang1, lang2")
					.setValue(this.plugin.settings.additionalLanguages)
					.onChange(async (value) => {
						this.plugin.settings.additionalLanguages = value;
						await this.plugin.saveSettings();

						// Update the languages in the suggester
						this.plugin.suggester.updateLanguages();
					}),
			);

		new Setting(containerEl)
			.setName("Reset last used language")
			.setDesc("Clear the last used language.")
			.addButton((button) =>
				button.setButtonText("Reset").onClick(async () => {
					this.plugin.settings.lastUsedLanguage = "";
					await this.plugin.saveSettings();
					this.display();
				}),
			);
	}
}
