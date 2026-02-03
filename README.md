# 🚀 SleekCMS Sync for VS Code & Cursor

Real-time bidirectional sync between VS Code/Cursor and SleekCMS. Edit your templates locally with the full power of your IDE while staying in sync with your SleekCMS server.

![Version](https://img.shields.io/badge/version-1.4.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 🔄 Real-Time Bidirectional Sync
- Automatically syncs changes between your IDE and SleekCMS
- Works both ways: edit locally or on the server
- Sub-second sync with smart debouncing
- Auto-refresh file tree when server updates
- **Virtual File System**: Files stored in memory - no workspace folder required!

### 🎨 Beautiful Two-Panel Interface
- **Top Panel**: Custom sidebar with all your saved sites
- **Bottom Panel**: Live file tree showing your synced templates
- One-click connection to any project
- Floating stop button for easy control
- Real-time status indicators with visual feedback

### 📁 File & Folder Management
- **Create Files**: New file button + right-click on folders
- **Create Folders**: Organize your templates with nested folders
- **Delete Files/Folders**: Trash icons with confirmation dialogs
- **Auto-Refresh Tree**: File tree updates automatically when server changes
- **Smart Icons**: Different icons for HTML, CSS, JS, JSON, and more

### 🌐 Multi-Site Management
- Save unlimited SleekCMS sites
- Switch between projects instantly
- Each site remembers its environment
- Auto-saves all changes when switching
- No confirmation popups - seamless switching!

### 🛡️ Reliable & Safe
- Conflict prevention built-in
- Graceful error handling
- All changes saved before stopping
- Remote change polling every 5 seconds
- File watcher for instant local updates
- **No Local Files**: Files stored in memory - server is source of truth

## 📦 Installation

### From VS Code/Cursor Marketplace (Recommended)
1. Open VS Code or Cursor
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "SleekCMS Sync"
4. Click Install

### From VSIX File
1. Download the `.vsix` file from [Releases](https://github.com/Lancerhawk/SleekSky_Extension/releases)
2. Open VS Code/Cursor
3. Extensions → `...` → Install from VSIX
4. Select the downloaded file

## 🚀 Quick Start

### 1. Add Your First Site
- Click the SleekCMS icon in the sidebar (left activity bar)
- Click the `+` button at the top
- Paste your SleekCMS API token (that's it!)
- The extension fetches your site details & picks the right environment automatically

### 2. Connect & Sync
- Click any site in the "My Sites" panel
- Your templates load into virtual workspace automatically
- Files appear in both the workspace explorer and custom file tree
- Start editing - changes sync in real-time to server!
- **No workspace folder needed** - extension creates virtual workspace automatically

### 3. Create & Edit Files
- Use the "New File" button in the file tree toolbar
- Or right-click any folder to add files there
- Files auto-sync to server when you save
- Delete with the trash icon (syncs to server)

### 4. Stop Syncing
- Click the "Stop Syncing" button in the top-right status bar
- All changes are saved automatically before stopping
- File tree disappears until you connect again

## 📖 Usage

### Adding a New Site
```
1. Click SleekCMS sidebar icon
2. Click "+" button (or Cmd+Shift+P → "SleekCMS: Add New Site")
3. Paste your SleekCMS token (e.g., 24z8o-abc123...)
4. Extension fetches the site name + metadata and saves it automatically
```

### Connecting to a Site
```
1. Click any site in the "My Sites" panel
2. Extension loads all templates into virtual workspace (stored in memory)
3. Files appear in workspace explorer and custom file tree
4. Edit files - changes auto-sync to server in 1 second!
5. No workspace folder needed - everything works in virtual file system!
```

### Switching Between Sites
```
1. Just click another site in the "My Sites" panel
2. Previous site auto-saves and disconnects (no popup!)
3. New site connects and loads immediately
4. File tree switches to new site's files
```

### Creating Files & Folders
```
Creating files:
1. Click "New File" button in file tree toolbar (creates in root)
2. OR right-click any folder → "New File" (creates inside that folder)
3. Enter filename (e.g., index.html, styles.css)
4. File opens automatically in editor
5. Save to sync to server!

Creating folders:
1. Click "New Folder" button in toolbar
2. OR right-click any folder → "New Folder"
3. Enter folder name (e.g., components, assets)
4. Folder appears in tree instantly
```

### Deleting Files & Folders
```
1. Hover over any file or folder in the tree
2. Click the trash icon that appears
3. Confirm deletion
4. File/folder deleted locally AND from server
```

## 🎯 All Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `SleekCMS: Add New Site` | Save a new site configuration | — |
| `SleekCMS: Stop Sync` | Stop syncing (saves all changes) | — |
| `SleekCMS: Refresh Current File` | Force refresh a file from server | — |
| `SleekCMS: Clear All Sites` | Remove all saved sites | — |

### Toolbar & Context Menu Actions
- **New File**: Create a file in root or selected folder
- **New Folder**: Create a folder in root or selected folder
- **Delete File/Folder**: Remove file/folder (syncs to server)
- **Refresh File Tree**: Manually refresh the file tree
- **Refresh Site List**: Reload saved sites

## 🔧 Configuration

The extension stores sites in VS Code's global state. No manual configuration needed!

### Environments & Token Suffixes
- **Production**: `https://app.sleekcms.com` (default when no suffix)
- **Staging**: `https://app-staging.sleekcms.com` (tokens ending with `-stg`)
- **Development**: `https://app.sleekcms.net` (tokens ending with `-dev`)
- **Localhost**: `http://localhost:9000` (tokens ending with `-local`)

Tokens are inspected automatically, so you never have to pick an environment manually. 

**Note**: Files are now stored in memory using a virtual file system. No local files are created - everything syncs directly with the server. The server is the source of truth, and files are re-fetched each time you connect.

### File Tree Icons
- 📄 HTML files: Code icon
- 🎨 CSS files: Code icon
- ⚡ JS files: Code icon
- 📋 JSON files: JSON icon
- 📝 Markdown files: Markdown icon
- 📁 Folders: Folder icon

## 🐛 Known Issues

- Server DELETE endpoint returns 501 (Not Implemented) - files are deleted from virtual file system and sync map, but server may not delete them
- Development/localhost environments may have incomplete API implementations
- Very large file trees (1000+ files) may have slight performance impact

## 📝 Requirements

- VS Code 1.85.0 or higher (or Cursor editor)
- Active SleekCMS account with API token
- Internet connection for syncing
- **No workspace folder required** - extension works standalone!

## 🤝 Contributing

Found a bug? Have a feature request? Want to contribute?

1. **Report issues**: [GitHub Issues](https://github.com/sleekcms/sleekcms-ide-extension/issues)
2. **Submit PRs**: [GitHub Pull Requests](https://github.com/sleekcms/sleekcms-ide-extension/pulls)
3. **Discussions**: [GitHub Discussions](https://github.com/sleekcms/sleekcms-ide-extension/discussions)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 👤 Author

**Arin Jain**
- Email: 70001933arin@gmail.com
- GitHub: [@Lancerhawk](https://github.com/sleekcms)

## 🙏 Acknowledgments

Built with ❤️ by Arin Jain for the SleekCMS community

## 🌟 Support

If you find this extension helpful:
- ⭐ Star the [GitHub repo](https://github.com/sleekcms/sleekcms-ide-extension)
- 📝 Leave a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ArinJain.sleekcms-sync)
- 🐛 Report bugs to help improve the extension
- 💡 Suggest new features

---

**Enjoy seamless template syncing!** 🚀