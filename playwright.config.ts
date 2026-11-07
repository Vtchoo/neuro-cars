import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/browser',
    timeout: 60000,
    workers: 1,
    outputDir: '.vite/browser-results',
    use: {
        baseURL: 'http://127.0.0.1:5173',
        viewport: {width:1280,height:900},
        launchOptions: {
            channel: process.platform === 'win32' ? 'chrome' : undefined,
            args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
        },
    },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
    },
})
