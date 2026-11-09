import { expect, test } from 'claude-code/testing'

const BOARD = JSON.stringify({
  updated: '2026-11-09',
  decide: [
    {
      id: '1',
      title: '拆不拆',
      options: [
        { key: '拆', label: '拆成两段' },
        { key: '不拆', label: '不拆' },
      ],
      recommend: '拆',
      why: '先能玩',
    },
  ],
  todo: [{ id: 'A', title: '演示', path: 'D:/x.exe' }],
  inProgress: [{ who: 'Ann', what: '小修' }],
  decided: [{ date: '2026-11-09', text: '英文' }],
})

const PANE = {
  plugin: 'decisions-pane',
  component: 'Pane',
  requestId: 'decisions',
  props: {
    title: '待你决定',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('cards draw and a press sends the answer', async ($, on) => {
  const submitted: string[] = []
  on('command.register', () => ({ value: { command: 'decisions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.read', () => ({ value: BOARD }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('clock.every', () => ({ value: {} }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /拆不拆/ }))?.text).toContain('拆不拆')
    expect((await ui.find({ type: 'Text', text: /Ann/ })) !== undefined).toBe(true)
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'b-1-拆' })
  await ui.press({ key: 'b-1-拆' })
  expect(submitted.length).toBe(1)
  expect(submitted[0]).toBe('【待你决定 1｜拆不拆】拆成两段')
  await ui.unmount()
  // The stubbed ui.invalidate redraws nothing: mount again to see the next drawing.
  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await again.find({ type: 'Text', text: /已送达/ }))?.text).toContain('拆成两段')
  await again.unmount()
})
