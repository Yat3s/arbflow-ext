import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import JavaScriptObfuscator from 'javascript-obfuscator'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

import manifest from './src/manifest'

function obfuscateInjectedPlugin(): Plugin {
  return {
    name: 'obfuscate-injected',
    apply: 'build',
    closeBundle() {
      const injectedPath = resolve(__dirname, 'build/injected/index.js')
      try {
        const code = readFileSync(injectedPath, 'utf-8')
        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.7,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.3,
          debugProtection: false,
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          renameGlobals: false,
          rotateStringArray: true,
          selfDefending: false,
          stringArray: true,
          stringArrayEncoding: ['base64'],
          stringArrayThreshold: 0.75,
          unicodeEscapeSequence: false,
        })
        writeFileSync(injectedPath, obfuscated.getObfuscatedCode())
        console.log('✅ Obfuscated injected/index.js')
      } catch (e) {
        console.warn('⚠️ Could not obfuscate injected/index.js:', e)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: 'build',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/chunk-[hash].js',
        },
      },
    },
    plugins: [crx({ manifest }), react(), obfuscateInjectedPlugin()],
    legacy: {
      skipWebSocketTokenCheck: true,
    },
  }
})
