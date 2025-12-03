import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as chokidar from 'chokidar';
import { SleekCMSApi, Template, SleekEnvironment } from './api';
import { StatusBarManager } from './statusBar';

const DEBOUNCE_DELAY = 1000;
const POLL_INTERVAL = 5000; // Check for remote changes every 5 seconds...too much work?

export class FileSyncManager {
    private api: SleekCMSApi;
    private viewsDir: string;
    private fileMap: { [key: string]: Template } = {};
    private watcher?: chokidar.FSWatcher;
    private isShuttingDown = false;
    private pendingUpdates: { [key: string]: NodeJS.Timeout } = {};
    private statusBar: StatusBarManager;
    private pollInterval?: NodeJS.Timeout;
    private isLocalUpdate = false;
    private remoteTemplateIds = new Set<string>();

    constructor(
        token: string,
        environment: SleekEnvironment,
        workspaceRoot: string,
        statusBar: StatusBarManager,
        folderName: string
    ) {
        this.api = new SleekCMSApi(token, environment);
        this.viewsDir = path.join(workspaceRoot, folderName);
        this.statusBar = statusBar;
        
        console.log(`Initialized with environment: ${environment}`);
    }

    async start() {
        try {
            this.statusBar.show('$(sync~spin) Fetching templates...');
            await this.fetchFiles();
            this.monitorFiles();
            this.startPolling(); 
            this.statusBar.show('$(check) SleekCMS Connected', 'Connected and syncing');
            vscode.window.showInformationMessage('SleekCMS sync started successfully!');
        } catch (error: any) {
            this.statusBar.show('$(error) SleekCMS Error', 'Failed to connect');
            vscode.window.showErrorMessage(`Failed to start sync: ${error.message}`);
            throw error;
        }
    }

    async stop() {
        this.isShuttingDown = true;
        
        // Stop polling if you can
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
        }
        
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = undefined;
        }

        // Clear pending updates please
        Object.values(this.pendingUpdates).forEach(timeout => clearTimeout(timeout));
        this.pendingUpdates = {};

        await this.cleanupFiles();
    }

    private startPolling() {
        console.log('Starting remote change polling...');
        this.pollInterval = setInterval(async () => {
            await this.checkForRemoteChanges();
        }, POLL_INTERVAL);
    }

    private async checkForRemoteChanges() {
        if (this.isShuttingDown || this.isLocalUpdate) return;

        try {
            const templates = await this.api.fetchAllTemplates();
            const currentRemoteIds = new Set<string>();
            
            for (const remoteTemplate of templates) {
                if (!remoteTemplate.file_path) continue;
                
                currentRemoteIds.add(remoteTemplate.id);
                const relativePath = remoteTemplate.file_path.replace(/\\/g, "/");
                const localTemplate = this.fileMap[relativePath];
                
                // NEW FILE: Template exists on server but not locally
                if (!localTemplate) {
                    console.log(`New remote file detected: ${relativePath}`);
                    await this.downloadNewFile(remoteTemplate);
                    continue;
                }
                
                // UPDATED FILE: Check if remote is newer than local
                if (new Date(remoteTemplate.updated_at) > new Date(localTemplate.updated_at)) {
                    console.log(`Remote change detected: ${relativePath}`);
                    await this.updateLocalFile(remoteTemplate);
                }
            }

            // DELETED FILES: Check if any local files were deleted from server or else just delete them
            for (const [relativePath, localTemplate] of Object.entries(this.fileMap)) {
                if (localTemplate.id && !currentRemoteIds.has(localTemplate.id)) {
                    console.log(`Remote deletion detected: ${relativePath}`);
                    await this.deleteLocalFile(relativePath);
                }
            }
            
        } catch (error: any) {
            console.error('Error checking remote changes:', error.message);
            // Don't show error to user on every poll failure or else you wont be use anymore
        }
    }

    private async downloadNewFile(template: Template) {
        try {
            this.isLocalUpdate = true;
            
            const relativePath = template.file_path.replace(/\\/g, "/");
            const filePath = path.join(this.viewsDir, template.file_path);
            
            // create the file please
            await fs.outputFile(filePath, template.code);
            this.fileMap[relativePath] = template;
            this.remoteTemplateIds.add(template.id);
            
            // add to watcher
            this.watcher?.add(filePath);
            
            setTimeout(() => {
                this.isLocalUpdate = false;
            }, 500);
            
            vscode.window.showInformationMessage(`⬇️ New file from server: ${relativePath}`);
        } catch (error: any) {
            console.error(`Error downloading new file:`, error.message);
            this.isLocalUpdate = false;
        }
    }

    private async updateLocalFile(template: Template) {
        try {
            this.isLocalUpdate = true;
            
            const relativePath = template.file_path.replace(/\\/g, "/");
            const filePath = path.join(this.viewsDir, template.file_path);
            
            // be blind for a couple moments
            this.watcher?.unwatch(filePath);
            
            // update local files
            await fs.outputFile(filePath, template.code);
            this.fileMap[relativePath] = template;
            
            // resume watching it
            this.watcher?.add(filePath);
            
            setTimeout(() => {
                this.isLocalUpdate = false;
            }, 500);
            
            vscode.window.showInformationMessage(`⬇️ Updated from server: ${relativePath}`);
        } catch (error: any) {
            console.error(`Error updating local file:`, error.message);
            this.isLocalUpdate = false;
        }
    }

    private async deleteLocalFile(relativePath: string) {
        try {
            this.isLocalUpdate = true;
            
            const filePath = path.join(this.viewsDir, relativePath);
            
            // stop watching please
            this.watcher?.unwatch(filePath);
            
            // delete this file please if you can
            await fs.remove(filePath);
            delete this.fileMap[relativePath];
            
            setTimeout(() => {
                this.isLocalUpdate = false;
            }, 500);
            
            vscode.window.showInformationMessage(`🗑️ Deleted from local: ${relativePath}`);
        } catch (error: any) {
            console.error(`Error deleting local file:`, error.message);
            this.isLocalUpdate = false;
        }
    }

    private async fetchFiles() {
        const templates = await this.api.fetchAllTemplates();
        await fs.ensureDir(this.viewsDir);

        for (const template of templates) {
            if (template.file_path) {
                const filePath = path.join(this.viewsDir, template.file_path);
                await fs.outputFile(filePath, template.code);
                this.fileMap[template.file_path.replace(/\\/g, "/")] = template;
                this.remoteTemplateIds.add(template.id);
                console.log(`Created: ${filePath}`);
            }
        }

        vscode.window.showInformationMessage(`Downloaded ${templates.length} templates`);
    }

    private async cleanupFiles() {
        try {
            await fs.remove(this.viewsDir);
            console.log('Cleanup complete');
        } catch (error: any) {
            console.error('Error during cleanup:', error.message);
        }
    }

    private monitorFiles() {
        this.watcher = chokidar.watch(this.viewsDir, {
            persistent: true,
            ignoreInitial: true,
            ignored: /\.vscode\//,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        })
        .on('change', (filePath) => this.scheduleUpdate(filePath))
        .on('add', (filePath) => this.handleNewFile(filePath))
        .on('unlink', (filePath) => this.handleDeletedFile(filePath));

        console.log('Watching for file changes...');
    }

    private async handleNewFile(filePath: string) {
        if (this.isShuttingDown || this.isLocalUpdate) return;

        const relativePath = path.relative(this.viewsDir, filePath).replace(/\\/g, "/");
        
        // Check if this file already exists in our map (might be from server ig)
        if (this.fileMap[relativePath]) {
            console.log(`File already tracked: ${relativePath}`);
            return;
        }

        console.log(`New local file detected: ${relativePath}`);
        await this.createSchema(filePath);
    }

    private async handleDeletedFile(filePath: string) {
        if (this.isShuttingDown || this.isLocalUpdate) return;

        const relativePath = path.relative(this.viewsDir, filePath).replace(/\\/g, "/");
        const template = this.fileMap[relativePath];

        if (!template?.id) {
            console.log(`Deleted file not in map: ${relativePath}`);
            return;
        }

        try {
            // Delete from server
            await this.api.deleteTemplate(template.id);
            delete this.fileMap[relativePath];
            this.remoteTemplateIds.delete(template.id);
            
            vscode.window.showInformationMessage(`🗑️ Deleted from server: ${relativePath}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to delete from server: ${error.message}`);
        }
    }

    private scheduleUpdate(filePath: string) {
        if (this.isShuttingDown || this.isLocalUpdate) return;

        const relativePath = path.relative(this.viewsDir, filePath).replace(/\\/g, "/");
        const template = this.fileMap[relativePath];

        if (!template?.id) {
            console.warn(`Skipping update: No matching file found for ${relativePath}`);
            return;
        }

        // Clear previous timeout
        if (this.pendingUpdates[template.id]) {
            clearTimeout(this.pendingUpdates[template.id]);
        }

        this.statusBar.show('$(sync~spin) Syncing...');

        // Schedule update
        this.pendingUpdates[template.id] = setTimeout(async () => {
            try {
                const code = await fs.readFile(filePath, 'utf-8');
                const updatedTemplate = await this.api.updateTemplate(template.id, code, template.updated_at);
                this.fileMap[relativePath] = updatedTemplate;
                
                this.statusBar.show('$(check) SleekCMS Connected', 'Synced');
                vscode.window.showInformationMessage(`✅ Updated: ${relativePath}`);
                
                delete this.pendingUpdates[template.id];
            } catch (error: any) {
                this.statusBar.show('$(error) Sync Error', 'Update failed');
                vscode.window.showErrorMessage(`Failed to update ${relativePath}: ${error.message}`);
                await this.refreshFile(filePath);
            }
        }, DEBOUNCE_DELAY);
    }

    async refreshFile(filePath: string) {
        try {
            const relativePath = path.relative(this.viewsDir, filePath).replace(/\\/g, "/");
            const template = this.fileMap[relativePath];
            
            if (!template?.id) {
                vscode.window.showWarningMessage('File not found in sync map');
                return;
            }

            const refreshedTemplate = await this.api.getTemplate(template.id);
            this.fileMap[relativePath] = refreshedTemplate;
            await fs.outputFile(filePath, refreshedTemplate.code);
            
            vscode.window.showInformationMessage(`✅ Refreshed: ${relativePath}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to refresh: ${error.message}`);
        }
    }

    private async createSchema(filePath: string) {
        if (this.isShuttingDown) return;

        try {
            const relativePath = path.relative(this.viewsDir, filePath).replace(/\\/g, "/");
            const schema = await this.api.createSchema(relativePath);
            const template = await this.api.getTemplate(schema.tmpl_main_id);

            if (relativePath !== template.file_path) {
                const oldPath = filePath;
                const newPath = path.join(this.viewsDir, template.file_path);
                
                this.watcher?.unwatch(oldPath);
                await fs.move(oldPath, newPath);
                this.watcher?.add(newPath);
                
                vscode.window.showInformationMessage(`Renamed: ${relativePath} → ${template.file_path}`);
            }

            this.fileMap[template.file_path.replace(/\\/g, "/")] = template;
            this.remoteTemplateIds.add(template.id);
            vscode.window.showInformationMessage(`✅ Created on server: ${template.file_path}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create on server: ${error.message}`);
            await fs.unlink(filePath);
        }
    }
}