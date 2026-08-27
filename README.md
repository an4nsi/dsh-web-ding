# dsh-web-ding

DSH web plugin: when the **main agent finishes a turn** (`running` true → false),
it raises a system notification and/or plays a two-note chime. Toggles live in
the **official Settings → General page** — no injected buttons anywhere else.

## Behavior

Toggles live in a dedicated **「Web Ding」 section** (Settings nav, last entry,
gear icon — the shell's slot contract carries no icon field). Rows follow the
native visual language: hairline-bordered layer-3 cards, `--dsw-alias-*` tokens,
better-sidebar's Switch recipe.

| 开关 | 效果 |
|---|---|
| 任务完成通知 | turn 结束时弹系统通知；开启瞬间就地请求权限（onChange 即用户手势） |
| 完成提示音 | turn 结束时播 C5→E5 双音（Web Audio 合成，不依赖通知中心）；开启瞬间播一声试听 |

State persists in `localStorage` (`dsh-web-ding.settings`) — deliberate: behind
a reverse proxy the framework's settings transport is loopback-only and would
forget toggles on reload.

## Architecture

- Invisible engine entry in `conversation.session.header.actions` (renders
  null) watches `useSessions((s) => s.byId[sessionId]?.running)`.
- A `settings.section` entry (`id: web-ding`, `order: 100`, label thunk)
  renders the two Switch rows. Contract notes: label is a thunk; icon is NOT
  carried (nav hardcodes a gear per id); component receives only `{ close }`.
  CSS ships via the preset's lightningcss inline plugin (ported into our
  tsdown.config.ts).
- `chime.ts` ports the motif from agegr/pi-web (`hooks/useAudio.ts`, MIT).

## Build & mount

```sh
npm install && npm run build   # -> lib/index.js + lib/client.js
```

Dev loop: with the dsh-flake `devMounts` mechanism, this repo can be
hot-mounted into a web profile (an insert row in `cordis.patch.yml`);
source edits hot-reload after `npm run build` — then hard-refresh the browser.
