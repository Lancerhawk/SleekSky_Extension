import * as vscode from 'vscode';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private stopButton?: vscode.StatusBarItem;

    constructor() {
        // Main status indicator (left side)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'sleekcms-sync.start';
    }

    show(text: string, tooltip?: string) {
        this.statusBarItem.text = text;
        if (tooltip) {
            this.statusBarItem.tooltip = tooltip;
        }
        this.statusBarItem.show();
    }

    hide() {
        this.statusBarItem.hide();
        this.hideStopButton();
    }

    // Show floating stop button in top right
    showStopButton(siteName: string) {
        if (!this.stopButton) {
            this.stopButton = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                1000 // High priority = far right
            );
        }

        this.stopButton.text = `$(debug-stop) Stop Syncing: ${siteName}`;
        this.stopButton.tooltip = `Click to stop syncing "${siteName}"`;
        this.stopButton.command = 'sleekcms-sync.stop';
        this.stopButton.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.stopButton.show();
    }

    hideStopButton() {
        if (this.stopButton) {
            this.stopButton.hide();
            this.stopButton.dispose();
            this.stopButton = undefined;
        }
    }

    dispose() {
        this.statusBarItem.dispose();
        this.hideStopButton();
    }
}