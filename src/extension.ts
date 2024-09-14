import * as vscode from "vscode";
import * as fs from "fs";

let output = vscode.window.createOutputChannel("Templ Go To Definition");

// disable debug output
output.appendLine = () => { };

export function activate(context: vscode.ExtensionContext) {
    const provider = new TemplDefinitionProvider();
    const disposable = vscode.languages.registerDefinitionProvider(
        { language: "go" },
        provider,
    );
    context.subscriptions.push(disposable);
}

export function deactivate() {}

class TemplDefinitionProvider implements vscode.DefinitionProvider {
    private isRecursing = false;

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
    ): Promise<vscode.Definition | vscode.LocationLink[] | null | undefined> {
        if (this.isRecursing) {
            return null;
        }

        this.isRecursing = true;

        try {
            const definitions = await this.getDefinitions(document, position);
            if (!definitions) return null;

            const definition = definitions[0];
            if (!this.isTemplGoFile(definition.uri.fsPath)) {
                return definitions;
            }

            const templFilePath = this.deriveTemplFilePath(
                definition.uri.fsPath,
            );
            if (!fs.existsSync(templFilePath)) {
                output.appendLine(
                    `Template file ${templFilePath} does not exist. Ignoring.`,
                );
                return definitions;
            }

            return this.handleTemplFile(
                templFilePath,
                document,
                position,
                definitions,
            );
        } finally {
            this.isRecursing = false;
        }
    }

    private async getDefinitions(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.Location[] | null> {
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            "vscode.executeDefinitionProvider", document.uri, position
        );

        if (!definitions || definitions.length === 0) {
            output.appendLine("No definitions found");
            return null;
        }

        return definitions;
    }

    private isTemplGoFile(filePath: string): boolean {
        if (!filePath.endsWith("_templ.go")) {
            output.appendLine(
                "Definition is not a _templ.go file. Ignoring.",
            );
            return false;
        }
        return true;
    }

    private deriveTemplFilePath(goFilePath: string): string {
        const templFilePath = goFilePath.replace(/_templ\.go$/, ".templ");
        output.appendLine(`.templ file: ${templFilePath}`);
        return templFilePath;
    }

    private async handleTemplFile(
        templFilePath: string,
        document: vscode.TextDocument,
        position: vscode.Position,
        definitions: vscode.Location[],
    ): Promise<vscode.Definition | vscode.LocationLink[] | null | undefined> {
        try {
            const templDoc =
                await vscode.workspace.openTextDocument(templFilePath);
            const functionName = this.extractFunctionName(document, position);
            const match = this.findTemplFunction(
                templDoc.getText(),
                functionName,
            );

            if (match) {
                await this.openAndGoToTemplDefinition(
                    templDoc,
                    match.index,
                    functionName,
                );
                return null;
            } else {
                output.appendLine(
                    `Templ function "${functionName}" not found. Falling back.`,
                );
                return definitions;
            }
        } catch (error: any) {
            output.appendLine(`Error: ${error.message}`);
            return definitions;
        }
    }

    private findTemplFunction(
        templText: string,
        functionName: string,
    ): RegExpExecArray | null {
        const regex = new RegExp(
            `^templ\\s+${this.escapeRegExp(functionName)}\\b`,
            "m",
        );
        return regex.exec(templText);
    }

    private async openAndGoToTemplDefinition(
        templDoc: vscode.TextDocument,
        matchIndex: number,
        functionName: string,
    ): Promise<void> {
        const positionInTempl = templDoc.positionAt(matchIndex + 6);
        const endPositionInTempl = templDoc.positionAt(
            matchIndex + 6 + functionName.length,
        );
        const templDocEditor = await vscode.window.showTextDocument(templDoc, {
            preview: false,
            selection: new vscode.Selection(positionInTempl, positionInTempl),
        });
        this.highlightWord(
            templDocEditor,
            new vscode.Range(positionInTempl, endPositionInTempl),
        );
    }

    private highlightWord(editor: vscode.TextEditor, range: vscode.Range) {
        const highlightDecoration =
            vscode.window.createTextEditorDecorationType({
                backgroundColor: "rgba(255, 255, 0, 0.2)",
            });

        editor.setDecorations(highlightDecoration, [range]);

        setTimeout(() => {
            editor.setDecorations(highlightDecoration, []);
            highlightDecoration.dispose();
        }, 500);
    }

    private extractFunctionName(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): string {
        const wordRange =
            document.getWordRangeAtPosition(position) ||
            new vscode.Range(position, position);
        return document.getText(wordRange).trim();
    }

    private escapeRegExp(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
