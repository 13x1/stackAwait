// vite.config.js
import fs from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';

// relative to ./src/
const exports = ['main.ts'];
const main = exports[0];

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
    build: {
        lib: {
            entry: toEntry({ exports, main }),
            formats: ['es', 'cjs']
        },
        sourcemap: true,
        minify: false
    },
    plugins: [
        dts({
            exclude: ['./vite.config.ts', './src/tests/**/*']
        }),
        tsconfigPaths()
    ],
    test: {
        include: ['./src/tests/**/*.test.ts'],
        benchmark: {
            outputFile: './test-results/vitest-benchmark.json'
        },
        outputFile: './test-results/vitest-report/index.html',
        reporters: ['html', 'default'],
        exclude: [
            './src/**/*.js'
        ],
        coverage: {
            provider: 'istanbul',
            exclude: [
                'src/kvin2/index.js',
                'src/kvin2',
                'src/kvin2/',
                'src/kvin2/*',
            ],
            reportsDirectory: './test-results/vitest-coverage'
        }
    }
});

// helper to generate entry

function toEntry({ exports, main }: { exports: string[]; main: string }) {
    // update package.json
    const pkg = JSON.parse(fs.readFileSync(resolve(__dirname, './package.json'), 'utf-8'));
    const oldExports = pkg.exports;
    pkg.exports = {};
    for (const file of exports) {
        const fileWithoutExt = file.replace(/\.[^/.]+$/, '');

        pkg.exports[file === main ? '.' : './' + fileWithoutExt] = {
            import: './dist/' + fileWithoutExt + '.mjs',
            require: './dist/' + fileWithoutExt + '.js'
        };
    }

    if (JSON.stringify(pkg.exports) !== JSON.stringify(oldExports)) {
        console.warn('package.json exports changed, updating & re-formatting...');
        fs.writeFileSync(resolve(__dirname, './package.json'), JSON.stringify(pkg, null, 4));
        execSync('npx prettier --write package.json');
    }

    return exports.map(file => resolve(__dirname, './src/', file));
}
