import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

// Reads the same GitHub Releases feed electron-builder publishes to
// (via build.publish in package.json) and installs silently on quit.
export function setupAutoUpdates() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    console.error('[autoUpdater]', error)
  })

  void autoUpdater.checkForUpdatesAndNotify()
}
