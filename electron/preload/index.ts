import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateSkillInput,
  InstallRepoSkillInput,
  RepoCatalog,
  SkillFile,
  WorkspaceConfig,
  WorkspaceSnapshot,
} from '../main/workspace/types'

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
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('skilldex:pick-directory'),
    enableSkill: (id: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:enable-skill', id),
    disableSkill: (id: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:disable-skill', id),
    removeSkill: (id: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:remove-skill', id),
    toggleFavourite: (id: string): Promise<WorkspaceSnapshot> =>
      ipcRenderer.invoke('skilldex:toggle-favourite', id),
    updateSkillReadme: (id: string, content: string): Promise<WorkspaceSnapshot> =>
      ipcRenderer.invoke('skilldex:update-skill-readme', id, content),
    createSkill: (input: CreateSkillInput): Promise<WorkspaceSnapshot> =>
      ipcRenderer.invoke('skilldex:create-skill', input),
    listRepoCatalogs: (): Promise<RepoCatalog[]> => ipcRenderer.invoke('skilldex:list-repo-catalogs'),
    addSkillRepo: (input: string): Promise<RepoCatalog[]> =>
      ipcRenderer.invoke('skilldex:add-skill-repo', input),
    removeSkillRepo: (slug: string): Promise<RepoCatalog[]> =>
      ipcRenderer.invoke('skilldex:remove-skill-repo', slug),
    refreshSkillRepo: (slug: string): Promise<RepoCatalog[]> =>
      ipcRenderer.invoke('skilldex:refresh-skill-repo', slug),
    installRepoSkill: (input: InstallRepoSkillInput): Promise<WorkspaceSnapshot> =>
      ipcRenderer.invoke('skilldex:install-repo-skill', input),
  },
})
