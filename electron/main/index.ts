import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkForUpdate, fetchLatestMacYml, isReleaseUrl, type UpdateInfo } from './update-check'
import { setupAutoUpdates } from './updater'
import { createModCatalog } from './mods/mod-catalog'
import { createConfigStore } from './workspace/config'
import { createSkillWorkspace } from './workspace/skill-workspace'
import type {
  CreateSkillInput,
  InstallRepoSkillInput,
  ScanRepoSkillInput,
  WorkspaceConfig,
} from './workspace/types'

// In dev the dock/menu show the default "Electron" name; override it before the
// app is ready. (Packaged builds get the name from build.productName.)
app.setName('Skilldex')

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 720,
    title: 'Skilldex',
    backgroundColor: '#09090b',
    icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // In dev the macOS dock shows the default Electron icon; set ours explicitly.
  // (Packaged builds get the icon from build/icon.icns via electron-builder.)
  if (process.platform === 'darwin' && app.dock) {
    const devIcon = path.join(app.getAppPath(), 'build', 'icon.png')
    if (existsSync(devIcon)) app.dock.setIcon(nativeImage.createFromPath(devIcon))
  }

  const configStore = createConfigStore(path.join(app.getPath('userData'), 'config.json'))
  const workspace = createSkillWorkspace({ homeDir: os.homedir(), configStore })

  ipcMain.handle('skilldex:get-config', () => workspace.getConfig())
  ipcMain.handle('skilldex:get-snapshot', () => workspace.getSnapshot())
  ipcMain.handle('skilldex:configure-sources', (_event, config: WorkspaceConfig) =>
    workspace.configureSources(config),
  )
  ipcMain.handle('skilldex:get-skill-readme', (_event, id: string) => workspace.getSkillReadme(id))
  ipcMain.handle('skilldex:list-skill-files', (_event, id: string) => workspace.listSkillFiles(id))
  ipcMain.handle('skilldex:reveal-skill', async (_event, id: string) => {
    const target = await workspace.resolveSkillPath(id)
    if (target) shell.showItemInFolder(target)
    return target !== null
  })
  ipcMain.handle('skilldex:pick-directory', async () => {
    const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(parent, {
      title: 'Choose a project folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    const picked = result.canceled ? undefined : result.filePaths[0]
    return picked && existsSync(picked) ? picked : null
  })
  ipcMain.handle('skilldex:enable-skill', (_event, id: string) => workspace.enableSkill(id))
  ipcMain.handle('skilldex:disable-skill', (_event, id: string) => workspace.disableSkill(id))
  ipcMain.handle('skilldex:remove-skill', (_event, id: string) => workspace.removeSkill(id))
  ipcMain.handle('skilldex:toggle-favourite', (_event, id: string) => workspace.toggleFavourite(id))
  ipcMain.handle('skilldex:update-skill-readme', (_event, id: string, content: string) =>
    workspace.updateSkillReadme(id, content),
  )
  ipcMain.handle('skilldex:create-skill', (_event, input: CreateSkillInput) => workspace.createSkill(input))
  ipcMain.handle('skilldex:list-repo-catalogs', () => workspace.listRepoCatalogs())
  ipcMain.handle('skilldex:add-skill-repo', (_event, input: string) => workspace.addSkillRepo(input))
  ipcMain.handle('skilldex:remove-skill-repo', (_event, slug: string) => workspace.removeSkillRepo(slug))
  ipcMain.handle('skilldex:refresh-skill-repo', (_event, slug: string) => workspace.refreshSkillRepo(slug))
  ipcMain.handle('skilldex:install-repo-skill', (_event, input: InstallRepoSkillInput) =>
    workspace.installRepoSkill(input),
  )
  ipcMain.handle('skilldex:scan-skill', (_event, id: string) => workspace.scanSkill(id))
  ipcMain.handle('skilldex:mark-skill-reviewed', (_event, id: string, reviewed: boolean) =>
    workspace.markSkillReviewed(id, reviewed),
  )
  ipcMain.handle('skilldex:scan-repo-skill', (_event, input: ScanRepoSkillInput) =>
    workspace.scanRepoSkill(input),
  )

  // Windows and Linux update themselves (updater.ts). macOS can't without a
  // signed app, so there the sidebar only says a new version is out.
  // SKILLDEX_PREVIEW_UPDATE=1 shows the card in dev, against the real latest release.
  const previewUpdate = process.env.SKILLDEX_PREVIEW_UPDATE === '1'
  let updateCheck: Promise<(UpdateInfo & { currentVersion: string }) | null> | null = null
  ipcMain.handle('skilldex:check-for-update', () => {
    if (!previewUpdate && (!app.isPackaged || process.platform !== 'darwin')) return null
    const currentVersion = previewUpdate ? '0.0.0' : app.getVersion()
    updateCheck ??= checkForUpdate({ currentVersion, fetchLatest: fetchLatestMacYml }).then((update) =>
      update ? { ...update, currentVersion: app.getVersion() } : null,
    )
    return updateCheck
  })
  ipcMain.handle('skilldex:open-release', async (_event, url: unknown) => {
    if (!isReleaseUrl(url)) return false
    await shell.openExternal(url)
    return true
  })

  const mods = createModCatalog({ homeDir: os.homedir() })
  ipcMain.handle('skilldex:list-mods', () => mods.list())
  ipcMain.handle('skilldex:set-mod-enabled', (_event, id: string, enabled: boolean) => mods.setEnabled(id, enabled))
  ipcMain.handle('skilldex:get-mod-detail', (_event, id: string) => mods.getDetail(id))
  ipcMain.handle('skilldex:reveal-mod', async (_event, id: string) => {
    const target = await mods.resolvePath(id)
    if (target) shell.showItemInFolder(target)
    return target !== null
  })

  createMainWindow()
  setupAutoUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
