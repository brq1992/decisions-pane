import type { EngineInterface, Register } from 'claude-code'

import type { Board, Decision, Todo } from '../types'

const PANE = 'decisions'
const TITLE = '待你决定'
/** Where the board is looked for, relative to the session's working directory, first found wins. The `file` option goes first. */
const DEFAULT_FILES = ['.claude/decisions.json', 'decisions.json']
let files: string[] = DEFAULT_FILES
const POLL_MS = 3000

const CARD_ICONS = ['🍡', '🥟', '🍜', '🍢', '🧋', '🍙']
const CARD_COLORS = ['warning', 'claude', 'suggestion', 'permission', 'planMode']
const MOODS = ['🥺', '🙏', '👀', '🫡']

// What the pane draws. Module variables: a reload starts them over, and session.start reads the file again.
let current: Board | null = null
let failure: string | null = null
let sentFor: Record<string, string> = {}
let showDone = false

function parse(text: string): Board {
  const raw = JSON.parse(text)
  const list = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    updated: String(raw.updated ?? ''),
    title: typeof raw.title === 'string' ? raw.title : '📋 待你决定',
    assistant: typeof raw.assistant === 'string' ? raw.assistant : 'Claude',
    avatars: raw.avatars && typeof raw.avatars === 'object' ? raw.avatars : {},
    decide: list(raw.decide),
    todo: list(raw.todo),
    inProgress: list(raw.inProgress),
    decided: list(raw.decided),
  }
}

let lastText = ''
let known: string[] | null = null

type Loaded = { kind: 'same' } | { kind: 'error'; message: string } | { kind: 'ok'; board: Board }

/** Reads the file; 'same' when it has not changed since the last read. Toasts new decisions, sets the status line. */
async function load($: EngineInterface): Promise<Loaded> {
  let text: string | null = null
  for (const file of files) {
    try {
      text = (await $.fs.read(file)) as string
      break
    } catch {
      // try the next place
    }
  }
  if (text === null) {
    if (lastText === '<missing>') return { kind: 'same' }
    lastText = '<missing>'
    return { kind: 'error', message: `找不到待办数据：${files.join('、')}` }
  }
  if (text === lastText) return { kind: 'same' }
  lastText = text
  let next: Board
  try {
    next = parse(text)
  } catch (err) {
    return { kind: 'error', message: `decisions.json 读不出：${String(err)}` }
  }
  const ids = next.decide.map(d => d.id)
  if (known !== null) {
    const added = next.decide.filter(d => !known!.includes(d.id))
    if (added.length > 0) $.ui.toast(`待你决定新增：${added.map(d => d.title).join('；')}`)
  }
  known = ids
  $.ui.status(ids.length > 0 ? `待你决定：${ids.length}` : undefined)
  return { kind: 'ok', board: next }
}

async function poll($: EngineInterface) {
  const got = await load($)
  if (got.kind === 'same') return
  if (got.kind === 'error') {
    failure = got.message
  } else {
    failure = null
    current = got.board
    const ids = got.board.decide.map(d => d.id)
    // A sent answer is kept only while its decision is still listed.
    sentFor = Object.fromEntries(Object.entries(sentFor).filter(([id]) => ids.includes(id)))
  }
  $.ui.invalidate('ui.render')
}

async function answer($: EngineInterface, d: Decision, text: string) {
  const body = text.trim()
  if (body === '') return
  // One answer per decision and text: repeated presses (or a press while the redraw is pending) send nothing more.
  if (sentFor[d.id] === body) {
    $.ui.toast(`📮 「${body}」已经送达过啦，${current?.assistant ?? 'Claude'} 处理完会移走～`)
    return
  }
  sentFor = { ...sentFor, [d.id]: body }
  $.ui.invalidate('ui.render')
  await $.prompt.submit({ text: `【待你决定 ${d.id}｜${d.title}】${body}`, asUser: true })
}

function toggleDone($: EngineInterface) {
  showDone = !showDone
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  const own = typeof options?.file === 'string' && options.file.trim() !== '' ? [options.file.trim()] : []
  files = [...own, ...DEFAULT_FILES]

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'decisions', description: '打开「待你决定」面板' })
    await poll($)
    $.clock.every(POLL_MS, () => void poll($))
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'decisions' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: '🍲 待办板来啦～' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const b = current
    const err = failure
    const s = sentFor
    const done = showDone

    const section = (icon: string, label: string, color: string, count?: number) => (
      <Box marginTop={1}>
        <Text bold color={color}>
          {icon} {label}
          {count !== undefined ? ` × ${count}` : ''}
        </Text>
      </Box>
    )

    const card = (d: Decision, i: number) => {
      const answered = s[d.id]
      return (
        <Box key={`d-${d.id}`} flexDirection="column" borderStyle="round" borderColor={answered ? 'success' : CARD_COLORS[i % CARD_COLORS.length]} paddingX={1} marginTop={1}>
          <Text bold>
            {CARD_ICONS[i % CARD_ICONS.length]} {d.id}. {d.title}
          </Text>
          {d.detail && <Text dimColor>💬 {d.detail}</Text>}
          {d.blocks && <Text dimColor>🚧 不定会卡住：{d.blocks}</Text>}
          {d.options.map(o => {
            const isPick = o.key === d.recommend
            return (
              <Box key={`o-${d.id}-${o.key}`} flexDirection="column" marginTop={1}>
                <Box gap={1}>
                  <Button
                    key={`b-${d.id}-${o.key}`}
                    label={isPick ? `👉 ${o.label} ⭐推荐` : `${o.label}`}
                    variant={isPick ? 'primary' : 'secondary'}
                    onPress={() => void answer($, d, o.label)}
                  />
                </Box>
                {o.detail && <Text dimColor>   ✨ {o.detail}</Text>}
              </Box>
            )
          })}
          {d.recommend && d.why && (
            <Box marginTop={1}>
              <Text color="suggestion">{b.avatars[b.assistant] ?? '🤖'} {b.assistant} 小声说：选「{d.recommend}」吧～{d.why}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Input
              key={`i-${d.id}`}
              label="✏️ "
              placeholder="都不喜欢？在这里说说你的想法，回车就发～"
              submitLabel="发送 💌"
              onSubmit={value => void answer($, d, value)}
            />
          </Box>
          {answered && <Text color="success">📮 已送达：「{answered}」，{b.assistant} 正在处理中～</Text>}
        </Box>
      )
    }

    const todo = (t: Todo) => (
      <Box key={`t-${t.id}`} flexDirection="column" borderStyle="round" borderColor={t.waiting ? 'inactive' : 'suggestion'} paddingX={1} marginTop={1}>
        <Text bold dimColor={t.waiting}>
          {t.waiting ? '⏳' : '🎮'} {t.id}. {t.title}
          {t.waiting ? '（还在路上～）' : ''}
        </Text>
        {t.detail && <Text dimColor>{t.detail}</Text>}
        {t.path && (
          <Box flexDirection="column">
            <Text>📁 {t.path}</Text>
            <Box>
              <Button key={`cp-${t.id}`} label="📋 复制路径" onPress={press => void $.ui.copy({ text: t.path!, surface: press.surface })} />
            </Box>
          </Box>
        )}
        {t.doc && <Text dimColor>📖 清单：{t.doc}</Text>}
      </Box>
    )

    if (err) return <Text color="error">😵 哎呀，{err}</Text>
    if (!b) return <Text dimColor>🐾 读取中…</Text>

    const n = b.decide.length
    return (
      <Box flexDirection="column">
        <Box borderStyle="round" borderColor="claude" paddingX={1} flexDirection="column">
          <Text bold color="claude">{b.title}</Text>
          <Text>{n > 0 ? `${MOODS[n % MOODS.length]} 老板～有 ${n} 件事等你拍板！` : '🎉 没有要你决定的事啦，去喝杯茶吧～'}</Text>
          <Text dimColor>🕐 更新于 {b.updated} · 点按钮就是回复 {b.assistant} 哦</Text>
        </Box>
        {section('🤔', '需要你拍板', 'warning', n)}
        {n === 0 ? <Text dimColor>   （空空的，好清爽～）</Text> : b.decide.map(card)}
        {b.todo.length > 0 && section('🛠️', '需要你动动手', 'suggestion', b.todo.length)}
        {b.todo.map(todo)}
        {b.inProgress.length > 0 && section('🏃', '大家在忙（不用你管）', 'claude')}
        {b.inProgress.map((p, i) => (
          <Text key={`p-${i}`}>
            {'   '}
            {b.avatars[p.who] ?? '🙂'} <Text bold>{p.who}</Text>：{p.what}
          </Text>
        ))}
        {b.decided.length > 0 && (
          <Box marginTop={1} gap={1}>
            <Text bold color="success">
              ✅ 最近已定 × {b.decided.length}
            </Text>
            <Button key="toggle-done" label={done ? '🙈 收起' : '👀 展开'} onPress={() => void toggleDone($)} />
          </Box>
        )}
        {done &&
          b.decided.map((x, i) => (
            <Text key={`x-${i}`} dimColor>
              {'   '}🌟 {x.date} {x.text}
            </Text>
          ))}
      </Box>
    )
  })
}
