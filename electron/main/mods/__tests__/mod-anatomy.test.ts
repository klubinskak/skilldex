import { describe, expect, it } from 'vitest'
import { readAnatomy } from '../mod-anatomy'

describe('readAnatomy', () => {
  it('reads a band, a command and a tool hook', () => {
    const source = `
      on('session.start', async ($, e, next) => {
        await $.command.register({
          name: 'repo-bar',
          description: 'Toggle the band',
        })
        await $.process.run(['git', 'status'], { cwd })
      })
      on('command.run', { command: 'repo-bar' }, async $ => ({ text: 'ok' }))
      on('tool.call', { tool: 'Bash' }, ($, e, next) => next(e))
      on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => next(e))
    `
    expect(readAnatomy([source])).toEqual({
      surfaces: ['band', 'command', 'tool-hook'],
      commands: ['repo-bar'],
      events: ['command.run', 'session.start', 'tool.call', 'ui.render'],
      access: ['processes'],
    })
  })

  it('reads a pane, toasts, a prompt hook and model calls across modules', () => {
    const anatomy = readAnatomy([
      `await $.ui.open({ id: PANE, title: 'Threads' }); $.ui.toast('saved')`,
      `on('prompt.submit', async ($, e, next) => next(e)); await $.model.classify(text)`,
    ])
    expect(anatomy.surfaces).toEqual(['pane', 'toast', 'prompt'])
    expect(anatomy.access).toEqual(['model'])
  })

  it('returns nothing for a module that hooks nothing', () => {
    expect(readAnatomy(['export const register = () => {}'])).toEqual({
      surfaces: [],
      commands: [],
      events: [],
      access: [],
    })
  })
})
