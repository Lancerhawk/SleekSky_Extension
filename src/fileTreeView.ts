import * as vscode from 'vscode';
import * as path from 'path';

export class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        public readonly isDirectory: boolean,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        
        this.tooltip = filePath;
        this.contextValue = isDirectory ? 'folder' : 'file';
        
        // Use resourceUri to leverage VS Code's file icon theme for automatic icons
        // This provides the best file type icons based on user's icon theme
        this.resourceUri = vscode.Uri.parse(filePath);
        
        if (isDirectory) {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else {
            // Set icon based on file extension with expanded icon support
            this.iconPath = this.getFileIcon(label);
            this.command = {
                command: 'sleekcms-sync.openFile',
                title: 'Open File',
                arguments: [filePath]
            };
        }
    }

    private getFileIcon(fileName: string): vscode.ThemeIcon {
        const ext = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName).toLowerCase();
        
        // Special file names
        const specialFileIcons: { [key: string]: string } = {
            'package.json': 'symbol-package',
            'package-lock.json': 'symbol-package',
            'tsconfig.json': 'symbol-namespace',
            '.gitignore': 'git-commit',
            '.env': 'symbol-key',
            '.env.local': 'symbol-key',
            '.env.production': 'symbol-key',
            'dockerfile': 'package',
            'docker-compose.yml': 'package',
            'docker-compose.yaml': 'package',
            'readme.md': 'book',
            'license': 'law',
            'license.md': 'law',
            'changelog.md': 'history',
        };
        
        if (specialFileIcons[baseName]) {
            return new vscode.ThemeIcon(specialFileIcons[baseName]);
        }
        
        // Extension-based icons with expanded support
        const iconMap: { [key: string]: string } = {
            // Web
            '.html': 'code',
            '.htm': 'code',
            '.css': 'symbol-color',
            '.scss': 'symbol-color',
            '.sass': 'symbol-color',
            '.less': 'symbol-color',
            
            // JavaScript/TypeScript
            '.js': 'symbol-method',
            '.mjs': 'symbol-method',
            '.cjs': 'symbol-method',
            '.jsx': 'symbol-method',
            '.ts': 'symbol-class',
            '.tsx': 'symbol-class',
            '.d.ts': 'symbol-interface',
            
            // Data formats
            '.json': 'bracket',
            '.xml': 'bracket-dot',
            '.yaml': 'list-tree',
            '.yml': 'list-tree',
            '.toml': 'list-tree',
            '.csv': 'table',
            
            // Documentation
            '.md': 'markdown',
            '.mdx': 'markdown',
            '.txt': 'file-text',
            '.rtf': 'file-text',
            '.pdf': 'file-pdf',
            
            // Images
            '.png': 'file-media',
            '.jpg': 'file-media',
            '.jpeg': 'file-media',
            '.gif': 'file-media',
            '.svg': 'file-media',
            '.ico': 'file-media',
            '.webp': 'file-media',
            '.bmp': 'file-media',
            
            // Programming languages
            '.py': 'symbol-variable',
            '.rb': 'ruby',
            '.php': 'symbol-misc',
            '.java': 'symbol-class',
            '.c': 'symbol-operator',
            '.cpp': 'symbol-operator',
            '.h': 'symbol-interface',
            '.hpp': 'symbol-interface',
            '.cs': 'symbol-class',
            '.go': 'symbol-event',
            '.rs': 'symbol-struct',
            '.swift': 'symbol-event',
            '.kt': 'symbol-class',
            
            // Shell/Config
            '.sh': 'terminal',
            '.bash': 'terminal',
            '.zsh': 'terminal',
            '.fish': 'terminal',
            '.bat': 'terminal',
            '.cmd': 'terminal',
            '.ps1': 'terminal',
            
            // Database
            '.sql': 'database',
            '.db': 'database',
            '.sqlite': 'database',
            
            // Archives
            '.zip': 'file-zip',
            '.tar': 'file-zip',
            '.gz': 'file-zip',
            '.rar': 'file-zip',
            '.7z': 'file-zip',
            
            // Fonts
            '.ttf': 'text-size',
            '.otf': 'text-size',
            '.woff': 'text-size',
            '.woff2': 'text-size',
            '.eot': 'text-size',
            
            // Binary/Executables
            '.exe': 'file-binary',
            '.dll': 'file-binary',
            '.so': 'file-binary',
            '.dylib': 'file-binary',
        };
        
        return new vscode.ThemeIcon(iconMap[ext] || 'file');
    }
}

export class FileTreeProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FileTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private rootUri?: vscode.Uri;
    private fileWatcher?: vscode.FileSystemWatcher;

    constructor() {
        // Watch for file system changes - try multiple patterns
        try {
            // Pattern for sleekcms scheme files
            this.fileWatcher = vscode.workspace.createFileSystemWatcher('sleekcms:/**');
            this.fileWatcher.onDidChange(() => {
                console.log('File changed, refreshing tree');
                this.refresh();
            });
            this.fileWatcher.onDidCreate(() => {
                console.log('File created, refreshing tree');
                this.refresh();
            });
            this.fileWatcher.onDidDelete(() => {
                console.log('File deleted, refreshing tree');
                this.refresh();
            });
        } catch (error) {
            console.error('Error creating file watcher:', error);
        }
    }

    refresh(): void {
        console.log('FileTreeProvider: refresh() called');
        this._onDidChangeTreeData.fire(undefined);
    }

    setRootPath(uriPath: string | undefined): void {
        console.log(`FileTreeProvider: setRootPath called with: ${uriPath}`);
        if (uriPath) {
            // uriPath can be a virtual URI string or a local path
            this.rootUri = uriPath.startsWith('sleekcms:') 
                ? vscode.Uri.parse(uriPath)
                : vscode.Uri.file(uriPath);
            console.log(`FileTreeProvider: Root URI set to: ${this.rootUri.toString()}`);
        } else {
            this.rootUri = undefined;
            console.log('FileTreeProvider: Root URI cleared');
        }
        console.log('FileTreeProvider: Calling refresh after setRootPath');
        this.refresh();
    }

    getRootPath(): string | undefined {
        return this.rootUri?.toString();
    }

    dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
    }

    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        console.log(`FileTreeProvider: getTreeItem called for: ${element?.label || 'root'}`);
        return element;
    }

    async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
        console.log(`FileTreeProvider: getChildren called, element: ${element?.label || 'root'}, rootUri: ${this.rootUri?.toString() || 'none'}`);
        
        if (!this.rootUri) {
            console.log('FileTreeProvider: No root URI set, returning empty');
            return [];
        }

        let dirUri: vscode.Uri;
        if (element) {
            // element.filePath is a URI string
            dirUri = element.filePath.startsWith('sleekcms:') 
                ? vscode.Uri.parse(element.filePath)
                : vscode.Uri.file(element.filePath);
        } else {
            dirUri = this.rootUri;
        }

        console.log(`FileTreeProvider: Reading directory: ${dirUri.toString()}`);

        try {
            // Use VS Code's workspace API to read directory
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            console.log(`FileTreeProvider: Found ${entries.length} entries in directory`);
            
            const fileItems: FileTreeItem[] = [];

            for (const [name, fileType] of entries) {
                // Skip hidden files and .vscode
                if (name.startsWith('.')) {
                    console.log(`FileTreeProvider: Skipping hidden file: ${name}`);
                    continue;
                }

                const childUri = vscode.Uri.joinPath(dirUri, name);
                const isDirectory = fileType === vscode.FileType.Directory;

                console.log(`FileTreeProvider: Adding ${isDirectory ? 'directory' : 'file'}: ${name}`);

                const treeItem = new FileTreeItem(
                    name,
                    childUri.toString(),
                    isDirectory,
                    isDirectory 
                        ? vscode.TreeItemCollapsibleState.Expanded 
                        : vscode.TreeItemCollapsibleState.None
                );

                fileItems.push(treeItem);
            }

            // Sort: folders first, then files
            fileItems.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.label.localeCompare(b.label);
            });

            console.log(`FileTreeProvider: Returning ${fileItems.length} items`);
            return fileItems;
        } catch (error: any) {
            console.error('FileTreeProvider: Error reading directory:', error);
            console.error('FileTreeProvider: Error details:', error.message, error.stack);
            return [];
        }
    }
}