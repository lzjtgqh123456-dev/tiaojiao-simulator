import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [
          '**/data/**',
          '**/data/**/*',
          '**/data/app_storage.json',
          '**/data/portraits.json',
          '**/data/saves/**',
          '**/data/backups/**',
          '**/data/uploads/**',
          '**/dist/**',
          '**/.git/**',
          '**/node_modules/**',
        ],
      },
    },
  };
});
