import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { SiteTreeProvider, SavedSite } from './siteTreeView';
import { FileTreeProvider, FileTreeItem } from './fileTreeView';
import { SleekCMSApi } from './api';
import { createFolderName, detectEnvironmentFromToken, ensureFolderName } from './utils/siteHelpers';
import { SleekCMSFileSystemProvider } from './virtualFileSystem';

let fileSystemProvider: SleekCMSFileSystemProvider | undefined;
let statusBarManager: StatusBarManager | undefined;
let siteTreeProvider: SiteTreeProvider | undefined;
let fileTreeProvider: FileTreeProvider | undefined;
let currentSiteName: string | undefined;
let currentSiteId: string | undefined;
let currentWorkspaceFolderIndex: number | undefined;
let fileSystemProviderDisposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('SleekCMS Sync extension is now active!');

    statusBarManager = new StatusBarManager();
    context.subscriptions.push(statusBarManager);

    // Initialize Site TreeView (top section)
    siteTreeProvider = new SiteTreeProvider(context);
    vscode.window.registerTreeDataProvider('sleekcmsSites', siteTreeProvider);

    // Initialize File TreeView (bottom section)
    fileTreeProvider = new FileTreeProvider();
    vscode.window.registerTreeDataProvider('sleekcmsFiles', fileTreeProvider);
    context.subscriptions.push(fileTreeProvider);

    // Command: Add New Site
    let addSite = vscode.commands.registerCommand('sleekcms-sync.start', async () => {
        if (!statusBarManager || !siteTreeProvider) {
            vscode.window.showErrorMessage('Extension not initialized');
            return;
        }

        const token = await vscode.window.showInputBox({
            prompt: 'Enter your SleekCMS API Token',
            placeHolder: '24z8o-94dc3b7f86b0ddf281210d9ba5730c943ca16b134f1ca22063f491fda37ef471',
            ignoreFocusOut: true
        });

        if (!token) {
            vscode.window.showErrorMessage('Token is required');
            return;
        }

        const environment = detectEnvironmentFromToken(token);

        try {
            const siteDetails = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Fetching SleekCMS site details',
                    cancellable: false
                },
                async () => {
                    const api = new SleekCMSApi(token, environment);
                    return api.fetchSiteDetails();
                }
            );

            const folderName = createFolderName(siteDetails.name, token);

            await siteTreeProvider.addSite({
                id: siteDetails.id,
                name: siteDetails.name,
                token,
                environment,
                folderName,
                subdomain: siteDetails.subdomain,
                org: siteDetails.org
            });

            vscode.window.showInformationMessage(`✅ Site "${siteDetails.name}" saved for ${environment} environment! Click it to connect.`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fetch site details: ${error.message || error}`);
        }
    });

    // Command: Connect to Site (AUTO-SWITCH)
    let connectToSite = vscode.commands.registerCommand('sleekcms-sync.connectToSite', async (site: SavedSite) => {
        if (fileSystemProvider) {
            console.log(`Auto-switching from "${currentSiteName}" to "${site.name}"`);
            
            try {
                statusBarManager?.show('$(sync~spin) Saving changes...', 'Switching sites');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Remove old virtual workspace folder
                if (currentWorkspaceFolderIndex !== undefined) {
                    vscode.workspace.updateWorkspaceFolders(currentWorkspaceFolderIndex, 1);
                }
                
                // Dispose provider registration
                if (fileSystemProviderDisposable) {
                    fileSystemProviderDisposable.dispose();
                    fileSystemProviderDisposable = undefined;
                }
                
                fileSystemProvider.shutdown();
                fileSystemProvider = undefined;
                const previousSiteName = currentSiteName;
                currentSiteName = undefined;
                currentSiteId = undefined;
                currentWorkspaceFolderIndex = undefined;
                
                vscode.window.showInformationMessage(`💾 Saved "${previousSiteName}" and switching to "${site.name}"`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error switching sites: ${error.message}`);
                return;
            }
        }

        if (!statusBarManager || !fileTreeProvider) return;

        try {
            currentSiteName = site.name;
            // Use site ID if available, otherwise create a safe ID from token
            currentSiteId = site.id || `site-${site.token.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)}`;
            
            // Dispose old provider registration if exists
            if (fileSystemProviderDisposable) {
                fileSystemProviderDisposable.dispose();
                fileSystemProviderDisposable = undefined;
            }
            
            // Shutdown old provider if exists (from previous connection)
            if (fileSystemProvider) {
                (fileSystemProvider as SleekCMSFileSystemProvider).shutdown();
                fileSystemProvider = undefined;
            }
            
            // Create new file system provider
            fileSystemProvider = new SleekCMSFileSystemProvider(
                site.token,
                site.environment,
                currentSiteId
            );
            
            // Register file system provider (only once per connection)
            fileSystemProviderDisposable = vscode.workspace.registerFileSystemProvider('sleekcms', fileSystemProvider, { isCaseSensitive: false });
            context.subscriptions.push(fileSystemProviderDisposable);
            
            // Listen to file system provider changes to refresh tree (set up BEFORE initialization)
            const changeListener = fileSystemProvider.onDidChangeFile(() => {
                console.log('File system provider fired change event, refreshing tree');
                if (fileTreeProvider) {
                    fileTreeProvider.refresh();
                }
            });
            context.subscriptions.push(changeListener);
            
            // Initialize file system (load all templates)
            statusBarManager.show('$(sync~spin) Fetching templates...');
            await fileSystemProvider.initialize();
            
            // Start polling for remote changes
            fileSystemProvider.startPolling();
            
            // Show the file tree view - set context FIRST so view becomes visible
            await vscode.commands.executeCommand('setContext', 'sleekcms.syncing', true);
            console.log('Context sleekcms.syncing set to true');
            
            // Add virtual workspace folder
            const virtualUri = vscode.Uri.parse(`sleekcms:/${currentSiteId}/`);
            const workspaceFolders = vscode.workspace.workspaceFolders || [];
            currentWorkspaceFolderIndex = workspaceFolders.length;
            
            vscode.workspace.updateWorkspaceFolders(
                currentWorkspaceFolderIndex,
                0,
                { uri: virtualUri, name: site.name }
            );
            
            // Wait a bit for the view to become visible, then set root path
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Update file tree to use virtual URI (after context is set and view is visible)
            if (fileTreeProvider) {
                console.log(`Setting file tree root to: ${virtualUri.toString()}`);
                fileTreeProvider.setRootPath(virtualUri.toString());
                
                // Force refresh immediately and multiple times to ensure it shows
                console.log('Forcing immediate file tree refresh');
                fileTreeProvider.refresh();
                
                setTimeout(() => {
                    console.log('Forcing file tree refresh after initialization (attempt 1)');
                    if (fileTreeProvider) {
                        fileTreeProvider.refresh();
                    }
                }, 500);
                
                setTimeout(() => {
                    console.log('Forcing file tree refresh after initialization (attempt 2)');
                    if (fileTreeProvider) {
                        fileTreeProvider.refresh();
                    }
                }, 1500);
                
                setTimeout(() => {
                    console.log('Forcing file tree refresh after initialization (attempt 3)');
                    if (fileTreeProvider) {
                        fileTreeProvider.refresh();
                    }
                }, 3000);
            }
            
            statusBarManager.show('$(check) SleekCMS Connected', 'Connected and syncing');
            statusBarManager.showStopButton(site.name);
            
            vscode.window.showInformationMessage(`✅ Connected to "${site.name}" - files are now available in workspace!`);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to connect to "${site.name}": ${error.message}`);
            fileSystemProvider?.shutdown();
            fileSystemProvider = undefined;
            currentSiteName = undefined;
            currentSiteId = undefined;
            currentWorkspaceFolderIndex = undefined;
            vscode.commands.executeCommand('setContext', 'sleekcms.syncing', false);
        }
    });

    // Command: Remove Site
    let removeSite = vscode.commands.registerCommand('sleekcms-sync.removeSite', async (item: any) => {
        if (!siteTreeProvider) return;
        
        const answer = await vscode.window.showWarningMessage(
            `Remove "${item.site.name}"?`,
            'Yes', 'No'
        );
        
        if (answer === 'Yes') {
            if (currentSiteName === item.site.name && fileSystemProvider) {
                // Remove virtual workspace folder
                if (currentWorkspaceFolderIndex !== undefined) {
                    vscode.workspace.updateWorkspaceFolders(currentWorkspaceFolderIndex, 1);
                }
                
                fileSystemProvider.shutdown();
                fileSystemProvider = undefined;
                currentSiteName = undefined;
                currentSiteId = undefined;
                currentWorkspaceFolderIndex = undefined;
                statusBarManager?.hide();
                fileTreeProvider?.setRootPath(undefined);
                vscode.commands.executeCommand('setContext', 'sleekcms.syncing', false);
            }
            
            await siteTreeProvider.removeSite(item.site.token);
            vscode.window.showInformationMessage(`🗑️ Removed "${item.site.name}"`);
        }
    });

    // Command: Stop Sync
    let stopSync = vscode.commands.registerCommand('sleekcms-sync.stop', async () => {
        if (!fileSystemProvider) {
            vscode.window.showWarningMessage('No site is currently syncing');
            return;
        }

        const siteName = currentSiteName || 'site';
        
        try {
            statusBarManager?.show('$(sync~spin) Saving final changes...', 'Stopping sync');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Remove virtual workspace folder
            if (currentWorkspaceFolderIndex !== undefined) {
                vscode.workspace.updateWorkspaceFolders(currentWorkspaceFolderIndex, 1);
            }
            
            // Dispose provider registration
            if (fileSystemProviderDisposable) {
                fileSystemProviderDisposable.dispose();
                fileSystemProviderDisposable = undefined;
            }
            
            fileSystemProvider.shutdown();
            fileSystemProvider = undefined;
            currentSiteName = undefined;
            currentSiteId = undefined;
            currentWorkspaceFolderIndex = undefined;

            if (statusBarManager) {
                statusBarManager.hide();
            }

            // Hide file tree
            fileTreeProvider?.setRootPath(undefined);
            vscode.commands.executeCommand('setContext', 'sleekcms.syncing', false);

            vscode.window.showInformationMessage(`✅ Stopped syncing "${siteName}" (all changes saved)`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error stopping sync: ${error.message}`);
        }
    });

    // Command: Refresh File
    let refreshFile = vscode.commands.registerCommand('sleekcms-sync.refresh', async () => {
        if (!fileSystemProvider) {
            vscode.window.showWarningMessage('Sync is not running. Start sync first.');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No file is currently open');
            return;
        }

        const uri = editor.document.uri;
        if (uri.scheme !== 'sleekcms') {
            vscode.window.showWarningMessage('Current file is not a SleekCMS file');
            return;
        }

        try {
            await fileSystemProvider.refreshFile(uri);
            vscode.window.showInformationMessage('✅ File refreshed from server');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to refresh file: ${error.message}`);
        }
    });

    // Command: Clear All Sites
    let clearToken = vscode.commands.registerCommand('sleekcms-sync.clearToken', async () => {
        const answer = await vscode.window.showWarningMessage(
            'This will remove ALL saved sites. Continue?',
            'Yes', 'No'
        );
        
        if (answer === 'Yes') {
            if (fileSystemProvider) {
                // Remove virtual workspace folder
                if (currentWorkspaceFolderIndex !== undefined) {
                    vscode.workspace.updateWorkspaceFolders(currentWorkspaceFolderIndex, 1);
                }
                
                // Dispose provider registration
                if (fileSystemProviderDisposable) {
                    fileSystemProviderDisposable.dispose();
                    fileSystemProviderDisposable = undefined;
                }
                
                fileSystemProvider.shutdown();
                fileSystemProvider = undefined;
                currentSiteName = undefined;
                currentSiteId = undefined;
                currentWorkspaceFolderIndex = undefined;
                statusBarManager?.hide();
                fileTreeProvider?.setRootPath(undefined);
                vscode.commands.executeCommand('setContext', 'sleekcms.syncing', false);
            }
            
            await context.globalState.update('sleekcms.savedSites', []);
            siteTreeProvider?.refresh();
            vscode.window.showInformationMessage('🗑️ All sites cleared');
        }
    });

    // Command: Refresh Site List
    let refreshSiteList = vscode.commands.registerCommand('sleekcms-sync.refreshSiteList', () => {
        siteTreeProvider?.refresh();
        vscode.window.showInformationMessage('🔄 Site list refreshed');
    });

    // Command: Refresh File Tree
    let refreshFileTree = vscode.commands.registerCommand('sleekcms-sync.refreshFileTree', () => {
        fileTreeProvider?.refresh();
        vscode.window.showInformationMessage('🔄 File tree refreshed');
    });

    // Command: Open File
    let openFile = vscode.commands.registerCommand('sleekcms-sync.openFile', async (filePath: string) => {
        try {
            // filePath can be either a virtual URI string or a local path
            const uri = filePath.startsWith('sleekcms:') 
                ? vscode.Uri.parse(filePath)
                : vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
        }
    });

    // Command: New File
    let newFile = vscode.commands.registerCommand('sleekcms-sync.newFile', async (item?: FileTreeItem) => {
        if (!fileSystemProvider || !currentSiteId) {
            vscode.window.showErrorMessage('No site is currently connected');
            return;
        }

        // Determine target directory path
        let targetPath: string;
        if (item && item.isDirectory) {
            // Right-clicked on a folder - extract path from URI
            const uri = vscode.Uri.parse(item.filePath);
            targetPath = uri.path.replace(`/${currentSiteId}/`, '').replace(/^\//, '');
        } else {
            // Clicked toolbar button - use root
            targetPath = '';
        }

        // Ask for filename
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter file name (e.g., index.html, styles.css)',
            placeHolder: 'myfile.html',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value) return 'File name is required';
                if (value.includes('/') || value.includes('\\')) return 'File name cannot contain path separators';
                if (value.startsWith('.')) return 'File name cannot start with a dot';
                return null;
            }
        });

        if (!fileName) return;

        try {
            const filePath = targetPath ? `${targetPath}/${fileName}` : fileName;
            const uri = vscode.Uri.parse(`sleekcms:/${currentSiteId}/${filePath}`);
            
            // Create empty file using file system provider
            await fileSystemProvider.writeFile(uri, new TextEncoder().encode(''), { create: true, overwrite: false });
            
            // Open the new file
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
            
            vscode.window.showInformationMessage(`✅ Created: ${fileName} (will sync to server on save)`);
        } catch (error: any) {
            if (error.code === 'FileExists') {
                vscode.window.showErrorMessage(`File "${fileName}" already exists`);
            } else {
                vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
            }
        }
    });

    // Command: New Folder
    let newFolder = vscode.commands.registerCommand('sleekcms-sync.newFolder', async (item?: FileTreeItem) => {
        if (!fileSystemProvider || !currentSiteId) {
            vscode.window.showErrorMessage('No site is currently connected');
            return;
        }

        // Determine target directory path
        let targetPath: string;
        if (item && item.isDirectory) {
            // Right-clicked on a folder - extract path from URI
            const uri = vscode.Uri.parse(item.filePath);
            targetPath = uri.path.replace(`/${currentSiteId}/`, '').replace(/^\//, '');
        } else {
            // Clicked toolbar button - use root
            targetPath = '';
        }

        // Ask for folder name
        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter folder name',
            placeHolder: 'components',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value) return 'Folder name is required';
                if (value.includes('/') || value.includes('\\')) return 'Folder name cannot contain path separators';
                if (value.startsWith('.')) return 'Folder name cannot start with a dot';
                return null;
            }
        });

        if (!folderName) return;

        try {
            const folderPath = targetPath ? `${targetPath}/${folderName}` : folderName;
            const uri = vscode.Uri.parse(`sleekcms:/${currentSiteId}/${folderPath}/`);
            
            // Create directory using file system provider
            await fileSystemProvider.createDirectory(uri);
            
            vscode.window.showInformationMessage(`✅ Created folder: ${folderName}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create folder: ${error.message}`);
        }
    });

    // Command: Delete File
    let deleteFile = vscode.commands.registerCommand('sleekcms-sync.deleteFile', async (item: FileTreeItem) => {
        if (!item || item.isDirectory || !fileSystemProvider) return;

        const answer = await vscode.window.showWarningMessage(
            `Delete "${item.label}"? This will also delete it from the server.`,
            'Yes', 'No'
        );

        if (answer !== 'Yes') return;

        try {
            const uri = vscode.Uri.parse(item.filePath);
            await fileSystemProvider.delete(uri, { recursive: false });
            
            vscode.window.showInformationMessage(`🗑️ Deleted: ${item.label} (synced to server)`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to delete file: ${error.message}`);
        }
    });

    // Command: Delete Folder
    let deleteFolder = vscode.commands.registerCommand('sleekcms-sync.deleteFolder', async (item: FileTreeItem) => {
        if (!item || !item.isDirectory || !fileSystemProvider) return;

        const answer = await vscode.window.showWarningMessage(
            `Delete folder "${item.label}" and all its contents? This will also delete from the server.`,
            'Yes', 'No'
        );

        if (answer !== 'Yes') return;

        try {
            // Note: SleekCMS doesn't support folder deletion directly
            // We'd need to delete all files in the folder individually
            // For now, just show a message that this needs to be done file by file
            const uri = vscode.Uri.parse(item.filePath);
            
            // Try to delete - the provider will handle individual file deletions
            // This is a limitation - folders are virtual, so we can't delete them directly
            vscode.window.showWarningMessage('Folder deletion: Please delete files individually. Folders are virtual and will disappear when empty.');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to delete folder: ${error.message}`);
        }
    });

    context.subscriptions.push(
        addSite,
        connectToSite,
        removeSite,
        stopSync,
        refreshFile,
        clearToken,
        refreshSiteList,
        refreshFileTree,
        openFile,
        newFile,
        newFolder,
        deleteFile,
        deleteFolder
    );
}

export function deactivate() {
    if (fileSystemProvider) {
        fileSystemProvider.shutdown();
    }
    if (fileTreeProvider) {
        fileTreeProvider.dispose();
    }
}