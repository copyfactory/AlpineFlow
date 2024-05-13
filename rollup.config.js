import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import babel from 'rollup-plugin-babel';
import { terser } from "rollup-plugin-terser";
import scss from 'rollup-plugin-scss';
import filesize from "rollup-plugin-filesize";

// Common plugin configurations
const plugins = [
    resolve(),
    commonjs(),
    filesize(),
    babel({
        babelrc: false,
        exclude: 'node_modules/**',
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        node: 'current',
                    },
                },
            ],
        ],
    }),
    scss({ fileName: 'flow.css', outputStyle: "compressed" })
];

// Rollup configurations
export default [
    // CDN
    {
        input: 'builds/cdn.js',
        output: {
            file: 'dist/alpine-flow.cdn.js',
            format: 'umd',
            name: 'alpine-flow',
        },
        plugins: plugins
    },
    // CDN - minified
    {
        input: 'builds/cdn.js',
        output: {
            file: 'dist/alpine-flow.cdn.min.js',
            format: 'umd',
            name: 'alpine-flow',
        },
        plugins: [...plugins, terser()],
    },
    // ESM
    {
        input: 'builds/esm.js',
        output: {
            file: 'dist/alpine-flow.esm.js',
            format: 'esm',
        },
        plugins: [...plugins, terser()]
    },
    // CommonJS
    {
        input: 'builds/esm.js',
        output: {
            file: 'dist/alpine-flow.cjs.js',
            format: 'cjs',
        },
        plugins: [...plugins, terser()]
    }
];
