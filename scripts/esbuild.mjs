import * as esbuild from 'esbuild';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const outdir = 'src/age_plotter/static/vendor';

// Ensure output directory exists
if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
}

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    entryPoints: ['src/age_plotter/static/js/vendor.entry.js'],
    bundle: true,
    outfile: `${outdir}/vendor.bundle.js`,
    format: 'iife',
    minify: !isWatch,
    sourcemap: isWatch,
    target: ['es2020'],
    define: {
        'process.env.NODE_ENV': '"production"'
    },
    // Don't use AMD/require - expose as globals
    globalName: '__vendorBundle',
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(buildOptions);
    console.log('Vendor bundle built successfully');
}
