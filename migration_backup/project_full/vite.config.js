import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import http from 'http'
import path from 'path'
import fs from 'fs'

function autoStartDjangoPlugin() {
  return {
    name: 'auto-start-django',
    configureServer() {
      const checkServer = () => {
        const req = http.get('http://127.0.0.1:8000/accounts/me/', () => {
          // Server is active
        });
        req.on('error', () => {
          console.log('\n[Auto-Launcher] Django server on port 8000 is offline. Launching automatically...\n');
          const venvWinPath = path.join(process.cwd(), 'venv_win', 'Scripts', 'python.exe');
          const pythonBin = fs.existsSync(venvWinPath)
            ? venvWinPath
            : (process.platform === 'win32' ? 'python' : 'python3');
          const djangoProc = spawn(pythonBin, ['manage.py', 'runserver', '0.0.0.0:8000'], {
            stdio: 'inherit',
            shell: false
          });
          djangoProc.on('error', (err) => {
            console.error('[Auto-Launcher] Failed to launch Django server:', err);
          });
        });
      };
      checkServer();
    }
  };
}

const bypassHtml = (req, res, proxyOptions) => {
  if (req.headers.accept && req.headers.accept.includes('html')) {
    return req.url;
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), autoStartDjangoPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/media/**', '**/staticfiles/**', '**/scratch/**', '**/*.tmp', '**/~$*', '**/db.sqlite3*']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/accounts/api/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/login/': { target: 'http://127.0.0.1:8000', changeOrigin: false, bypass: bypassHtml },
      '/accounts/signup/': { target: 'http://127.0.0.1:8000', changeOrigin: false, bypass: bypassHtml },
      '/accounts/verify-otp/': { target: 'http://127.0.0.1:8000', changeOrigin: false, bypass: bypassHtml },
      '/accounts/resend-otp/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/logout/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/create-checkout-session/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/update-txn/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/payment-success-verify/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/phonepe/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/download-invoice/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/google-login/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/google-signup/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/me/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/google/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/facebook/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/accounts/github/': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/process': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/download': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
