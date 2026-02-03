import * as vscode from 'vscode';
import { SleekEnvironment } from './api';
import { ensureFolderName } from './utils/siteHelpers';

export interface SavedSite {
    id?: string;
    name: string;
    token: string;
    environment: SleekEnvironment;
    folderName: string;
    subdomain?: string;
    org?: string;
    workspacePath?: string;
}

export class SiteTreeItem extends vscode.TreeItem {
    constructor(
        public readonly site: SavedSite,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isConnected: boolean = false
    ) {
        super(site.name, collapsibleState);
        
        // Build rich tooltip with connection status
        const statusLine = isConnected ? '● Connected' : '○ Click to connect';
        const envLine = `Environment: ${site.environment}`;
        const subdomainLine = site.subdomain ? `Subdomain: ${site.subdomain}` : '';
        
        this.tooltip = new vscode.MarkdownString(
            `### ${site.name}\n\n` +
            `**${statusLine}**\n\n` +
            `${envLine}${subdomainLine ? '\n\n' + subdomainLine : ''}`
        );
        
        // Show connection status in description
        this.description = isConnected 
            ? `● Connected` 
            : (site.subdomain || site.environment);
        
        this.contextValue = 'site';
        
        // Use different icon for connected vs disconnected
        this.iconPath = isConnected
            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon('database');
        
        // Make it clickable
        this.command = {
            command: 'sleekcms-sync.connectToSite',
            title: 'Connect',
            arguments: [site]
        };
    }
}

export class SiteTreeProvider implements vscode.TreeDataProvider<SiteTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SiteTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private connectedSiteToken: string | undefined;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
    
    setConnectedSite(token: string | undefined): void {
        this.connectedSiteToken = token;
        this.refresh();
    }
    
    getConnectedSiteToken(): string | undefined {
        return this.connectedSiteToken;
    }

    getTreeItem(element: SiteTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<SiteTreeItem[]> {
        const sites = this.getSavedSites();
        
        return sites.map(site => new SiteTreeItem(
            site, 
            vscode.TreeItemCollapsibleState.None,
            site.token === this.connectedSiteToken
        ));
    }

    getSavedSites(): SavedSite[] {
        const storedSites = this.context.globalState.get<Partial<SavedSite>[]>('sleekcms.savedSites', []) || [];
        const normalizedSites = storedSites.map(site => this.normalizeSite(site));

        const needsUpdate = storedSites.some((site, index) => site.folderName !== normalizedSites[index].folderName);
        if (needsUpdate) {
            void this.context.globalState.update('sleekcms.savedSites', normalizedSites);
        }

        return normalizedSites;
    }

    async addSite(site: SavedSite): Promise<void> {
        const sites = this.getSavedSites();
        const normalized = this.normalizeSite(site);
        const filtered = sites.filter(s => s.token !== normalized.token);
        filtered.push(normalized);
        await this.context.globalState.update('sleekcms.savedSites', filtered);
        vscode.commands.executeCommand('setContext', 'sleekcms.hasSites', true);
        this.refresh();
    }

    async removeSite(token: string): Promise<void> {
        const sites = this.getSavedSites();
        const filtered = sites.filter(s => s.token !== token);
        await this.context.globalState.update('sleekcms.savedSites', filtered);
        vscode.commands.executeCommand('setContext', 'sleekcms.hasSites', filtered.length > 0);
        this.refresh();
    }
    private normalizeSite(site: Partial<SavedSite>): SavedSite {
        const name = site.name || 'SleekCMS Site';
        const token = site.token || '';
        const environment = site.environment || 'production';
        const folderName = ensureFolderName(name, token, site.folderName);

        return {
            ...site,
            name,
            token,
            environment,
            folderName,
        } as SavedSite;
    }
}