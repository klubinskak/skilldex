import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

// Reads the same GitHub Releases feed electron-builder publishes to
// (via build.publish in package.json) and installs silently on quit.
// Windows and Linux only: macOS can't self-update an unsigned app (and the Mac
// build ships no .zip), so there the sidebar update card does the job instead.
export function setupAutoUpdates() {
  if (!app.isPackaged || process.platform === 'darwin') return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    console.error('[autoUpdater]', error)
  })

  // The 'error' listener above already logs it; this only stops it surfacing as unhandled.
  autoUpdater.checkForUpdatesAndNotify().catch(() => {})
}
