import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'electron-vite';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import viteCompression from 'vite-plugin-compression';
import VueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@renderer': resolve('src/renderer'),
        '@i18n': resolve('src/i18n')
      }
    },
    plugins: [
      vue(),
      viteCompression(),
      VueDevTools(),
      AutoImport({
        imports: [
          'vue',
          {
            'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar']
          }
        ]
      }),
      Components({
        resolvers: [NaiveUiResolver()]
      })
    ],
    publicDir: resolve('resources'),
    build: {
      rollupOptions: {
        output: {
          // Bundle everything into the entry chunk: splitting by shared dependency
          // would create a cross-chunk cycle with the `export *` in store/index.ts
          // and trigger a TDZ crash in production builds (dev never splits, so it hides this).
          // Electron loads locally with no CDN or first-paint budget, so one chunk is fine.
          manualChunks: () => 'index'
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 2389
    }
  }
});
