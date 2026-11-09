# decisions-pane 🍡

A Claude Code plugin: a cute side pane that shows what is waiting for **your** decision, read from a `decisions.json` the assistant keeps up to date. Each option is a button; pressing it (or typing your own answer) sends your reply into the chat.

一个 Claude Code 插件：在对话旁边常驻一个 Q 版面板，列出「待你决定」的事。数据来自助手维护的 `decisions.json`；点选项按钮（或自己写意见）就等于在对话里回复。

## Install

At the prompt of a terminal session:

```
/plugin install decisions-pane --marketplace brq1992/decisions-pane
```

From a shell:

```bash
claude plugin install decisions-pane --marketplace brq1992/decisions-pane
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `brq1992/decisions-pane`, then Add plugin.

Open the pane with `/decisions`.

## Data file

The plugin looks, relative to the session's working directory, for the `file` option if set, then `.claude/decisions.json`, then `decisions.json`, and re-reads it every 3 seconds.

```json
{
  "updated": "2026-11-09",
  "title": "📋 待你决定",
  "assistant": "Claude",
  "avatars": { "Claude": "🤖", "Ann": "🎨" },
  "decide": [
    {
      "id": "1",
      "title": "Split the next batch in two?",
      "detail": "Optional context.",
      "options": [
        { "key": "yes", "label": "Split it", "detail": "Optional" },
        { "key": "no", "label": "Keep one batch" }
      ],
      "recommend": "yes",
      "why": "Playable sooner",
      "blocks": "What waits on this"
    }
  ],
  "todo": [{ "id": "A", "title": "Try the build", "detail": "", "path": "C:\builds\game.exe", "waiting": false }],
  "inProgress": [{ "who": "Ann", "what": "Fixing the waiter pose" }],
  "decided": [{ "date": "2026-11-09", "text": "Labels stay in English" }]
}
```

A button sends `【待你决定 <id>｜<title>】<option label>` as your message. The same answer is sent only once per decision; the card shows it as delivered until the assistant moves the decision to `decided`.

Tell your assistant to add every question it needs you to answer to `decide`, and to move it to `decided` once you answer.
