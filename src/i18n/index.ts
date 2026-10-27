import { jp } from './jp'
import { zhHant, type Messages } from './zh-Hant'

export type Locale = 'zh-Hant' | 'jp'

const STORAGE_KEY = 'one-more-coin:locale'
let currentLocale: Locale = 'zh-Hant'

export function getLocale(): Locale { return currentLocale }
export function getMessages(): Messages { return currentLocale === 'jp' ? jp : zhHant }

export function loadLocale(): Locale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'jp' ? 'jp' : 'zh-Hant'
  } catch {
    return 'zh-Hant'
  }
}

export function setLocale(locale: Locale): void {
  currentLocale = locale
  try { window.localStorage.setItem(STORAGE_KEY, locale) } catch { /* Storage is optional. */ }
}

export function format(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}

export function applyStaticTranslations(): void {
  const messages = getMessages()
  document.documentElement.lang = currentLocale === 'jp' ? 'ja' : 'zh-Hant'
  document.title = messages.page.title
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', messages.page.description)
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n as keyof Messages['ui']
    element.textContent = messages.ui[key]
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = element.dataset.i18nAria as keyof Messages['ui']
    element.setAttribute('aria-label', messages.ui[key])
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const key = element.dataset.i18nTitle as keyof Messages['ui']
    element.title = messages.ui[key]
  }
}
