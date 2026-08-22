import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createConfigStore } from './workspace/config'
import { createSkillWorkspace } from './workspace/skill-workspace'
import type { CreateSkillInput, InstallRepoSkillInput, WorkspaceConfig } from './workspace/types'

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

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
