import type { SiteType } from '../lib/types'

export type ExtendedSiteType = SiteType | 'arbflow'

export const SITE_TYPE: ExtendedSiteType = window.location.hostname.includes('lighter.xyz')
  ? 'lighter'
  : window.location.hostname.includes('variational.io')
    ? 'omni'
    : window.location.hostname.includes('arbflow.io')
      ? 'arbflow'
      : null

console.log('[Arbflow] Content script loaded, SITE_TYPE:', SITE_TYPE)

