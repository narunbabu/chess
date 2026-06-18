import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // SECURITY (L6): refuse to bake the Gemini key into a production bundle. Set
  // ALLOW_INSECURE_GEMINI_KEY=true only for throwaway local/AI-Studio builds.
  if (mode === 'production' && env.GEMINI_API_KEY && env.ALLOW_INSECURE_GEMINI_KEY !== 'true') {
    throw new Error(
      'Refusing to inline GEMINI_API_KEY into a production bundle (L6). ' +
      'Proxy Gemini calls server-side, or set ALLOW_INSECURE_GEMINI_KEY=true for a local build.'
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // ⚠️ SECURITY (L6): this inlines GEMINI_API_KEY into the client bundle, so
      // the key is visible to anyone who opens the app. That is acceptable ONLY
      // for local dev / AI Studio. Before ANY public deployment, route Gemini
      // calls through a server-side proxy that holds the key and remove this
      // define. Fail the build if a key is present in a production build to
      // prevent accidental key leakage.
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
