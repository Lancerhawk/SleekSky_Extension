# Change Log

All notable changes to the "SleekCMS Sync" extension will be documented in this file.

## [1.3.1] - 2026-01-31

### 🛠️ Technical Improvements
- **Dependency Cleanup**: Removed unnecessary dependencies for cleaner package
  - Removed `chokidar` dependency (no longer needed with virtual file system)
  - Removed `fs-extra` dependency (no longer needed with virtual file system)
  - Reduced total dependencies from 3 to 1 (only `axios` required)
  - Smaller package size and faster installation
- **Code Cleanup**: Removed obsolete `fileSync.ts` file from previous implementation
- **Better Architecture**: Fully committed to virtual file system approach without legacy file-based code

### 📦 Package Improvements
- Lighter extension package with fewer dependencies
- Faster installation and updates
- Reduced potential for dependency conflicts

---

## [1.3.0] - 2026-01-31

### 🎉 Major Update: Virtual File System Architecture

#### ✨ New Features
- **Virtual File System**: Complete rewrite to use VS Code's `FileSystemProvider` API
  - Files are now stored in memory (RAM) instead of on disk
  - No workspace folder required - extension works without opening a local folder
  - Files are fetched from server on connection and stored in memory
  - Changes sync directly to server - no local file system involved
  - Similar to how Remote SSH extensions work
- **Virtual Workspace Folders**: SleekCMS sites appear as virtual workspace folders (`sleekcms:/<siteId>/`)
  - Files are accessible through VS Code's native file explorer
  - Full IDE integration - IntelliSense, syntax highlighting, and all editor features work
  - Files automatically appear in workspace when connected
- **No Save Prompts**: Prevents "Save workspace configuration" prompts when closing IDE
  - Virtual files don't trigger workspace save dialogs
  - Clean shutdown without unnecessary prompts

#### 🔄 Sync Improvements
- **Confirmation Messages**: Added user-friendly confirmation messages for all file operations
  - File uploads to server show confirmation
  - File downloads from server show confirmation
  - File creation shows confirmation
  - File deletion shows confirmation
- **Real-time File Tree**: Custom file tree view now works with virtual file system
  - Files appear automatically after connection
  - Tree refreshes on file changes
  - Uses VS Code's file system watcher for virtual files

#### 🛠️ Technical Improvements
- **Architecture Refactor**: Moved from local file-based sync to virtual file system
  - Removed dependency on `fs-extra` and `chokidar` for file operations
  - Uses `vscode.FileSystemProvider` for all file operations
  - Files stored in `Map<string, Template>` in memory
  - Directory structure inferred from file paths
- **Better Error Handling**: Improved error messages and recovery
  - Handles extension reloads gracefully
  - Prevents infinite connection loops
  - Proper cleanup of virtual workspace folders
- **Memory Management**: Files are loaded into memory on connection
  - Files persist in memory while connected
  - Memory is freed when disconnecting
  - Server is source of truth - files re-fetched on each connection

#### 🐛 Bug Fixes
- Fixed "please open a workspace folder first" error - no longer required
- Fixed extension reload loops when switching sites
- Fixed file tree not showing files after connection
- Fixed workspace folder cleanup on extension reload
- Fixed save workspace prompts appearing on IDE close

#### 📋 Breaking Changes
- **No Local Files**: Files are no longer saved to disk
  - Previous versions saved files to workspace folders
  - New version stores everything in memory
  - Files must be synced to server to persist
- **Workspace Folder Not Required**: Extension now works without opening a workspace folder
  - Previous versions required a workspace folder
  - New version creates virtual workspace folders automatically

#### 🎯 User Experience
- **One-Click Connection**: Click a site once to connect and see files
  - No need to open workspace folder first
  - Files appear automatically in virtual workspace
  - Custom file tree also shows files
- **Seamless Switching**: Switch between sites without workspace folder issues
  - Old site's virtual folder is removed automatically
  - New site's virtual folder is created automatically
  - No manual cleanup required

## [1.2.0] - 2025-11-21

### ✨ New
- **Token-Only Setup**: Adding a site now requires just the SleekCMS token. The extension calls the `/site` endpoint to pull the official site name, subdomain, and org automatically.
- **Automatic Environment Detection**: Tokens ending with `-dev`, `-stg`, or `-local` now route to development, staging, or localhost endpoints automatically. Tokens without suffix default to production.
- **Smart Folder Naming**: Synced folders inside your workspace are now named after the SleekCMS site (e.g., `doctor-or-clinic-site-views`) for easier navigation across projects.

### 🛠️ Fixes & Improvements
- Normalize previously saved sites so they receive deterministic folder names without requiring user intervention.
- Surface each site's subdomain inside the tree view tooltip/description for quicker identification.
- Added staging API base scaffolding (`https://app-staging.sleekcms.com/api/template`) for upcoming infrastructure parity.

## [1.1.0] - 2024-11-20

### 🎉 Major Update: File Management & UI Improvements

#### ✨ New Features
- **Two-Panel Sidebar**: Added dedicated file tree panel below site list
  - Top panel: "My Sites" - all saved sites
  - Bottom panel: "Files" - live file tree (only visible when syncing)
- **File Creation**: Create new files from toolbar or by right-clicking folders
- **Folder Creation**: Create nested folder structures for better organization
- **File Deletion**: Delete files and folders with trash icons (syncs to server)
- **Auto-Refresh File Tree**: File tree automatically updates when server changes files
- **File Watcher**: Uses Chokidar to watch for local and remote changes

#### 🎨 UI Enhancements
- **Custom Sidebar Icon**: Sleek cloud sync icon in activity bar
- **Context Menus**: Right-click folders for "New File" and "New Folder" options
- **Inline Icons**: Trash icons appear on hover for files and folders
- **Smart File Icons**: Different icons for HTML, CSS, JS, JSON, Markdown, and more
- **Sorted Tree**: Folders appear first, then files (both alphabetically sorted)

#### 🔄 Sync Improvements
- **Seamless Site Switching**: No confirmation popups - just click and switch
- **Auto-Save on Switch**: Previous site saves all changes before switching
- **Better Status Messages**: Clearer feedback with emojis (💾, ✅, 🗑️, ⬇️)
- **File Tree Disposal**: Properly cleans up file watchers when stopping sync

#### 🛠️ Technical Improvements
- **Disposable Resources**: Proper cleanup of file watchers and event listeners
- **Memory Management**: File tree watcher stops when not syncing
- **Error Handling**: Better error messages for file/folder operations
- **Input Validation**: Prevents invalid file/folder names (no slashes, dots, etc.)

#### 📋 New Commands
- `New File` - Create a new file in root or selected folder
- `New Folder` - Create a new folder structure
- `Delete File` - Remove a file (syncs to server)
- `Delete Folder` - Remove a folder and contents (syncs to server)
- `Refresh File Tree` - Manually refresh the file tree

#### 🎯 Improved Features
- **Auto-Open New Files**: Created files open automatically in editor
- **Duplicate Prevention**: Checks if file/folder already exists before creating
- **Confirmation Dialogs**: Warns before deleting files or folders
- **Real-time Updates**: File tree updates instantly on any change

---

## [1.0.0] - 2024-11-20

### 🎉 Initial Release

#### ✨ Core Features
- **Real-time Bidirectional Sync**: Automatically sync templates between VS Code and SleekCMS server
- **Automatic Change Detection**: Monitors file changes and syncs them to the server with 1-second debounce
- **Remote Polling**: Checks for server-side changes every 5 seconds and updates local files automatically
- **Multi-Site Management**: Save and manage multiple SleekCMS sites with custom names

#### 🎨 User Interface
- **Custom Sidebar View**: Dedicated activity bar icon showing all saved sites
- **TreeView Site List**: Click any saved site to instantly connect and start syncing
- **Floating Stop Button**: Prominent stop sync button appears in the top-right status bar
- **Status Indicators**: Real-time sync status with icons (syncing, connected, error states)
- **Site Management**: Add, remove, and organize multiple SleekCMS projects

#### 🔄 Sync Capabilities
- **Upload Changes**: Local file edits automatically sync to SleekCMS server
- **Download Changes**: Server-side updates automatically download to local workspace
- **New File Creation**: Create new files locally and they're automatically added to the server
- **File Deletion Sync**: Delete files locally or remotely - changes sync both ways
- **Conflict Prevention**: `isLocalUpdate` flag prevents infinite sync loops
- **Graceful Shutdown**: Ensures all pending changes are saved before stopping sync

#### 🌐 Environment Support
- **Production Environment**: Connect to https://app.sleekcms.com
- **Development Environment**: Connect to https://app.sleekcms.net
- **Localhost Support**: Test with local development server at http://localhost:9000

#### 🔐 Authentication & Security
- **Token Management**: Securely save and manage API tokens per site
- **Persistent Storage**: Sites and tokens saved across VS Code sessions
- **Environment Selection**: Choose environment per site for flexible workflows

#### 🛠️ Developer Features
- **Auto File Renaming**: Server-generated file paths automatically rename local files
- **Template Mapping**: Maintains internal map of all synced templates
- **Debounced Updates**: Prevents excessive API calls during rapid edits
- **Error Handling**: Comprehensive error messages with retry mechanisms
- **File Watcher**: Uses Chokidar for reliable file system monitoring

#### 📋 Commands
- `SleekCMS: Add New Site` - Save a new site with token and environment
- `SleekCMS: Stop Sync` - Stop syncing current site (saves all changes first)
- `SleekCMS: Refresh Current File` - Force refresh a file from server
- `SleekCMS: Clear All Sites` - Remove all saved sites

#### 🎯 Smart Features
- **Auto-Switch Projects**: Switch between sites without manual confirmation - automatically saves previous site
- **Cleanup on Stop**: Removes temporary files when stopping sync
- **Visual Feedback**: Emoji-rich notifications for all operations (⬇️ download, ✅ success, 🗑️ delete)
- **Site Context**: Always shows which site is currently syncing

#### 🐛 Known Limitations
- Server DELETE endpoint returns 501 (Not Implemented) - deletion tracked locally only
- Development/Localhost environments may have incomplete API implementations

### Technical Details
- Built with TypeScript
- Uses Axios for HTTP requests
- Chokidar for file system watching
- fs-extra for file operations
- Supports VS Code 1.85.0+

---

## Future Roadmap

### Planned Features
- [ ] Conflict resolution UI when both local and remote change simultaneously
- [ ] Sync history and rollback capability
- [ ] Multi-workspace support
- [ ] Custom sync intervals (configurable polling)
- [ ] Offline mode with sync queue
- [ ] Template preview in sidebar
- [ ] Search/filter sites and files
- [ ] Import/export site configurations
- [ ] Sync statistics dashboard
- [ ] Batch file operations
- [ ] Git-like diff view for changes
- [ ] File rename functionality
- [ ] Drag-and-drop file organization
- [ ] Keyboard shortcuts for common actions

---

**Full Changelog**: https://github.com/sleekcms/sleekcms-ide-extension/commits/main