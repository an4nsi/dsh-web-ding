/**
 * dsh-web-ding — browser half.
 *
 * Three slot contributions, all official:
 *  1. INVISIBLE engine in the conversation header slot whose effects watch
 *     this session's running flag (main agent stops outputting);
 *  2. "Web Ding" SECTION in Settings (settings.section, order 100 = last)
 *     hosting both toggles with native look (--dsw-alias-* tokens);
 *  3. (removed) general.item rows — superseded by the section.
 *
 * State persists via localStorage (store.ts): reverse-proxied browsers only
 * get memory persistence from the framework settings transport.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { TurnWatch } from './TurnWatch.tsx'
import { WebDingSection } from './WebDingSection.tsx'

export const name = 'dsh-web-ding'
export const inject = ['slots']

type SlotsService = {
  inject(name: string, factory: () => unknown): void
  register(
    opts: { name: string; id: string; order?: number; label?: () => string },
    component: unknown,
  ): unknown
}

export function apply(ctx: ClientContext): void {
  const slots = ctx.slots as unknown as SlotsService

  slots.inject('conversation.session.header.actions', () =>
    slots.register(
      { name: 'conversation.session.header.actions', id: 'web-ding-engine', order: 99 },
      TurnWatch,
    ),
  )

  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'web-ding',
        order: 100, // native max is 20 → last, like better-sidebar
        label: () => 'Web Ding', // thunk; brand name, locale-independent
      },
      WebDingSection,
    ),
  )
}
