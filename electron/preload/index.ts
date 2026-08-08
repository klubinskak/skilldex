import { contextBridge, ipcRenderer } from 'electron'
import type { SkillFile, WorkspaceConfig, WorkspaceSnapshot } from '../main/workspace/types'

contextBridge.exposeInMainWorld('skilldex', {
  workspace: {
    getConfig: (): Promise<WorkspaceConfig> => ipcRenderer.invoke('skilldex:get-config'),
    getSnapshot: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:get-snapshot'),
    configureSources: (config: WorkspaceConfig): Promise<WorkspaceSnapshot> =>
      ipcRenderer.invoke('skilldex:configure-sources', config),
    getSkillReadme: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('skilldex:get-skill-readme', id),
    listSkillFiles: (id: string): Promise<SkillFile[] | null> =>
      ipcRenderer.invoke('skilldex:list-skill-files', id),
    revealSkill: (id: string): Promise<boolean> => ipcRenderer.invoke('skilldex:reveal-skill', id),
  },
})
