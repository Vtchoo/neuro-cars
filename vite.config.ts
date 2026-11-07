import { defineConfig } from 'vite';
import type { ViteDevServer } from 'vite';

function register3dRoute(server: Pick<ViteDevServer, 'middlewares'>) {
  server.middlewares.use((request, response, next) => {
    const path = request.url?.split('?')[0];
    if (path === '/3d' || path === '/3d/debug') {
      response.writeHead(302, { Location: `${path}/${request.url!.slice(path.length)}` });
      response.end();
      return;
    }
    next();
  });
}

export default defineConfig({
  plugins: [{
    name: '3d-route',
    configureServer: register3dRoute,
    configurePreviewServer: register3dRoute,
  }],
  root: '.',
  publicDir: 'public',
  base: './',
  server: {
    open: true
  },
  build: {
    outDir: 'docs',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
        three: './3d/index.html',
        carDebug: './3d/debug/index.html'
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
