import * as vscode from 'vscode';
import { SleekCMSApi, Template, SleekEnvironment } from './api';

export class SleekCMSFileSystemProvider implements vscode.FileSystemProvider {
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    private fileMap: Map<string, Template> = new Map(); // Maps file paths to templates
    private directoryCache: Map<string, string[]> = new Map(); // Maps directory paths to their children
    private api: SleekCMSApi;
    private siteId: string;
    private pollInterval?: NodeJS.Timeout;
    private isShuttingDown = false;
    private isLocalUpdate = false;

    constructor(token: string, environment: SleekEnvironment, siteId: string) {
        this.api = new SleekCMSApi(token, environment);
        this.siteId = siteId;
    }

    watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
        // Return a disposable that does nothing - we handle changes via polling
        return new vscode.Disposable(() => {});
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const path = this.getPathFromUri(uri);
        
        // Root directory (empty path or just siteId)
        if (path === '' || path === this.siteId) {
            return {
                type: vscode.FileType.Directory,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 0
            };
        }
        
        // Check if it's a file
        const template = this.fileMap.get(path);
        if (template) {
            return {
                type: vscode.FileType.File,
                ctime: new Date(template.updated_at).getTime(),
                mtime: new Date(template.updated_at).getTime(),
                size: Buffer.byteLength(template.code || '', 'utf8')
            };
        }

        // Check if it's a directory
        const dirPath = path.endsWith('/') ? path : path + '/';
        if (this.directoryCache.has(dirPath)) {
            return {
                type: vscode.FileType.Directory,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 0
            };
        }

        // Check if any file starts with this path (it's a directory)
        for (const filePath of this.fileMap.keys()) {
            if (filePath.startsWith(dirPath) || filePath.startsWith(path + '/')) {
                return {
                    type: vscode.FileType.Directory,
                    ctime: Date.now(),
                    mtime: Date.now(),
                    size: 0
                };
            }
        }

        throw vscode.FileSystemError.FileNotFound(uri);
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const path = this.getPathFromUri(uri);
        console.log(`SleekCMSFileSystemProvider: readDirectory called with URI: ${uri.toString()}, path: "${path}"`);
        
        const dirPath = path === '' || path === this.siteId ? '' : (path.endsWith('/') ? path : path + '/');
        console.log(`SleekCMSFileSystemProvider: dirPath: "${dirPath}", fileMap size: ${this.fileMap.size}`);
        
        const children = new Map<string, vscode.FileType>();
        
        // Find all files and directories under this path
        for (const filePath of this.fileMap.keys()) {
            if (dirPath === '') {
                // Root directory - get first level items
                const parts = filePath.split('/');
                const firstPart = parts[0];
                if (firstPart && !children.has(firstPart)) {
                    const isDir = parts.length > 1;
                    children.set(firstPart, isDir ? vscode.FileType.Directory : vscode.FileType.File);
                    console.log(`SleekCMSFileSystemProvider: Root - added ${isDir ? 'directory' : 'file'}: ${firstPart}`);
                }
            } else if (filePath.startsWith(dirPath)) {
                const relativePath = filePath.substring(dirPath.length);
                const parts = relativePath.split('/');
                const firstPart = parts[0];
                if (firstPart && !children.has(firstPart)) {
                    const isDir = parts.length > 1;
                    children.set(firstPart, isDir ? vscode.FileType.Directory : vscode.FileType.File);
                    console.log(`SleekCMSFileSystemProvider: Subdir - added ${isDir ? 'directory' : 'file'}: ${firstPart}`);
                }
            }
        }

        const result = Array.from(children.entries());
        console.log(`SleekCMSFileSystemProvider: readDirectory returning ${result.length} items`);
        return result;
    }

    readFile(uri: vscode.Uri): Uint8Array {
        const path = this.getPathFromUri(uri);
        const template = this.fileMap.get(path);
        
        if (!template) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        return new TextEncoder().encode(template.code || '');
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        const path = this.getPathFromUri(uri);
        const code = new TextDecoder().decode(content);
        
        this.isLocalUpdate = true;

        try {
            const existingTemplate = this.fileMap.get(path);
            
            if (existingTemplate) {
                // Update existing file
                const updatedTemplate = await this.api.updateTemplate(
                    existingTemplate.id,
                    code,
                    existingTemplate.updated_at
                );
                this.fileMap.set(path, updatedTemplate);
                this._fireFileChange(uri, vscode.FileChangeType.Changed);
                
                // Show confirmation message
                const fileName = path.split('/').pop() || path;
                vscode.window.showInformationMessage(`✅ Saved to server: ${fileName}`, { modal: false });
            } else {
                // Create new file
                const schema = await this.api.createSchema(path);
                const template = await this.api.getTemplate(schema.tmpl_main_id);
                
                // If server renamed the file, update our path
                if (template.file_path !== path) {
                    this.fileMap.set(template.file_path.replace(/\\/g, '/'), template);
                    const newUri = this.getUriFromPath(template.file_path.replace(/\\/g, '/'));
                    this._fireFileChange(newUri, vscode.FileChangeType.Created);
                    const fileName = template.file_path.split('/').pop() || template.file_path;
                    vscode.window.showInformationMessage(`✅ Created on server: ${fileName}`, { modal: false });
                } else {
                    this.fileMap.set(path, template);
                    this._fireFileChange(uri, vscode.FileChangeType.Created);
                    const fileName = path.split('/').pop() || path;
                    vscode.window.showInformationMessage(`✅ Created on server: ${fileName}`, { modal: false });
                }
            }
        } catch (error: any) {
            const fileName = path.split('/').pop() || path;
            vscode.window.showErrorMessage(`❌ Failed to save ${fileName}: ${error.message}`);
            throw vscode.FileSystemError.Unavailable(`Failed to write file: ${error.message}`);
        } finally {
            setTimeout(() => {
                this.isLocalUpdate = false;
            }, 500);
        }
    }

    async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
        const path = this.getPathFromUri(uri);
        const template = this.fileMap.get(path);
        
        if (!template) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        this.isLocalUpdate = true;
        const fileName = path.split('/').pop() || path;

        try {
            await this.api.deleteTemplate(template.id);
            this.fileMap.delete(path);
            this._fireFileChange(uri, vscode.FileChangeType.Deleted);
            vscode.window.showInformationMessage(`🗑️ Deleted from server: ${fileName}`, { modal: false });
        } catch (error: any) {
            // Server might return 501, but we still delete locally
            this.fileMap.delete(path);
            this._fireFileChange(uri, vscode.FileChangeType.Deleted);
            // Show message even if server delete failed (501 error)
            vscode.window.showWarningMessage(`⚠️ Deleted locally (server may not support delete): ${fileName}`, { modal: false });
        } finally {
            setTimeout(() => {
                this.isLocalUpdate = false;
            }, 500);
        }
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
        // SleekCMS doesn't support rename directly, so we:
        // 1. Read the old file
        // 2. Create the new file
        // 3. Delete the old file
        const content = this.readFile(oldUri);
        await this.writeFile(newUri, content, { create: true, overwrite: options.overwrite });
        await this.delete(oldUri, { recursive: false });
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        // Directories are created implicitly when files are added
        // Just ensure the path exists in our cache
        const path = this.getPathFromUri(uri);
        const dirPath = path.endsWith('/') ? path : path + '/';
        if (!this.directoryCache.has(dirPath)) {
            this.directoryCache.set(dirPath, []);
        }
    }

    // Initialize: Load all templates from server
    async initialize(): Promise<void> {
        try {
            const templates = await this.api.fetchAllTemplates();
            console.log(`SleekCMSFileSystemProvider: Initializing with ${templates.length} templates`);
            this.fileMap.clear();
            this.directoryCache.clear();

            for (const template of templates) {
                if (template.file_path) {
                    const normalizedPath = template.file_path.replace(/\\/g, '/');
                    this.fileMap.set(normalizedPath, template);
                    console.log(`SleekCMSFileSystemProvider: Added file to map: ${normalizedPath}`);
                }
            }

            // Build directory cache
            this.buildDirectoryCache();
            console.log(`SleekCMSFileSystemProvider: Initialization complete. File map size: ${this.fileMap.size}`);
        } catch (error: any) {
            console.error(`SleekCMSFileSystemProvider: Initialization failed: ${error.message}`);
            throw new Error(`Failed to initialize file system: ${error.message}`);
        }
    }

    // Start polling for remote changes
    startPolling(): void {
        const POLL_INTERVAL = 5000;
        this.pollInterval = setInterval(async () => {
            if (!this.isShuttingDown && !this.isLocalUpdate) {
                await this.checkForRemoteChanges();
            }
        }, POLL_INTERVAL);
    }

    // Stop polling
    stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
        }
    }

    // Check for remote changes and update local cache
    private async checkForRemoteChanges(): Promise<void> {
        try {
            const templates = await this.api.fetchAllTemplates();
            const currentRemoteIds = new Set<string>();
            const remotePaths = new Map<string, Template>();

            for (const template of templates) {
                if (!template.file_path) continue;
                const normalizedPath = template.file_path.replace(/\\/g, '/');
                currentRemoteIds.add(template.id);
                remotePaths.set(normalizedPath, template);
            }

            // Check for new/updated files
            for (const [path, remoteTemplate] of remotePaths.entries()) {
                const localTemplate = this.fileMap.get(path);
                
                if (!localTemplate) {
                    // New file from server
                    this.fileMap.set(path, remoteTemplate);
                    const uri = this.getUriFromPath(path);
                    this._fireFileChange(uri, vscode.FileChangeType.Created);
                    
                    // Show confirmation message
                    const fileName = path.split('/').pop() || path;
                    vscode.window.showInformationMessage(`⬇️ New file from server: ${fileName}`, { modal: false });
                } else if (new Date(remoteTemplate.updated_at) > new Date(localTemplate.updated_at)) {
                    // Updated file from server
                    this.fileMap.set(path, remoteTemplate);
                    const uri = this.getUriFromPath(path);
                    this._fireFileChange(uri, vscode.FileChangeType.Changed);
                    
                    // Show confirmation message
                    const fileName = path.split('/').pop() || path;
                    vscode.window.showInformationMessage(`⬇️ Updated from server: ${fileName}`, { modal: false });
                }
            }

            // Check for deleted files
            for (const [path, localTemplate] of this.fileMap.entries()) {
                if (localTemplate.id && !currentRemoteIds.has(localTemplate.id)) {
                    this.fileMap.delete(path);
                    const uri = this.getUriFromPath(path);
                    this._fireFileChange(uri, vscode.FileChangeType.Deleted);
                    
                    // Show confirmation message
                    const fileName = path.split('/').pop() || path;
                    vscode.window.showInformationMessage(`🗑️ Deleted from server: ${fileName}`, { modal: false });
                }
            }

            this.buildDirectoryCache();
        } catch (error: any) {
            console.error('Error checking for remote changes:', error.message);
        }
    }

    // Build directory cache from file map
    private buildDirectoryCache(): void {
        this.directoryCache.clear();
        for (const filePath of this.fileMap.keys()) {
            const parts = filePath.split('/');
            for (let i = 0; i < parts.length - 1; i++) {
                const dirPath = parts.slice(0, i + 1).join('/') + '/';
                if (!this.directoryCache.has(dirPath)) {
                    this.directoryCache.set(dirPath, []);
                }
            }
        }
    }

    // Get file path from URI
    private getPathFromUri(uri: vscode.Uri): string {
        // URI format: sleekcms:/<siteId>/path/to/file or sleekcms:/<siteId>/
        const path = uri.path;
        // Remove leading slash and siteId
        const parts = path.split('/').filter(p => p && p !== this.siteId);
        return parts.join('/');
    }

    // Get URI from file path
    private getUriFromPath(filePath: string): vscode.Uri {
        return vscode.Uri.parse(`sleekcms:/${this.siteId}/${filePath}`);
    }

    // Fire file change event
    private _fireFileChange(uri: vscode.Uri, type: vscode.FileChangeType): void {
        this._emitter.fire([{ type, uri }]);
    }

    // Shutdown
    shutdown(): void {
        this.isShuttingDown = true;
        this.stopPolling();
    }

    // Refresh a specific file from server
    async refreshFile(uri: vscode.Uri): Promise<void> {
        const path = this.getPathFromUri(uri);
        const template = this.fileMap.get(path);
        
        if (!template?.id) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        try {
            const refreshedTemplate = await this.api.getTemplate(template.id);
            this.fileMap.set(path, refreshedTemplate);
            this._fireFileChange(uri, vscode.FileChangeType.Changed);
        } catch (error: any) {
            throw vscode.FileSystemError.Unavailable(`Failed to refresh file: ${error.message}`);
        }
    }
}

