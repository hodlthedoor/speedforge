import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isServe = command === 'serve';
  const isBuild = command === 'build';
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

  // Read package.json
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
  const dependencies = pkg.dependencies || {};

  return {
    plugins: [
      react(),
      tailwindcss(),
      electron([
        {
          // Use TypeScript files for Electron
          entry: 'electron/main.ts',
          onstart(options) {
            options.startup();
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
            esbuild: {
              // Recommended for TypeScript files
              format: 'esm',
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            options.reload();
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
            esbuild: {
              // Use CommonJS format for preload
              format: 'cjs',
            },
          },
        }
      ]),
      renderer(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  }
});
