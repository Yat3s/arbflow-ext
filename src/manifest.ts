import { defineManifest } from '@crxjs/vite-plugin'
import packageData from '../package.json'

//@ts-ignore
const isDev = process.env.NODE_ENV == 'development'

export default defineManifest({
  name: `${packageData.displayName || packageData.name}${isDev ? ` ➡️ Dev` : ''}`,
  description: packageData.description,
  version: packageData.version,
  manifest_version: 3,
  icons: {
    16: 'img/logo-16.png',
    32: 'img/logo-32.png',
    48: 'img/logo-48.png',
    128: 'img/logo-128.png',
  },
  action: {
    default_title: 'Open side panel',
  },
  options_page: 'options.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://app.lighter.xyz/*', 'https://omni.variational.io/*'],
      js: ['src/contentScript/index.ts'],
      run_at: 'document_start',
    },
  ],
  side_panel: {
    default_path: 'sidepanel.html',
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  host_permissions: [
    'https://app.lighter.xyz/*',
    'https://omni.variational.io/*',
    'https://mainnet.zklighter.elliot.ai/*',
    'https://ws.geek4.fun/*',
    '<all_urls>',
  ],
  web_accessible_resources: [
    {
      resources: [
        'img/logo-16.png',
        'img/logo-32.png',
        'img/logo-48.png',
        'img/logo-128.png',
        'injected/index.js',
        'wasm_exec.js',
        'lighter-signer.wasm',
      ],
      matches: ['https://app.lighter.xyz/*', 'https://omni.variational.io/*', '<all_urls>'],
    },
  ],
  permissions: ['sidePanel', 'activeTab', 'tabs', 'scripting', 'webRequest', 'storage'],
})
