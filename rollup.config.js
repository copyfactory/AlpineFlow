import babel from 'rollup-plugin-babel';
import filesize from 'rollup-plugin-filesize';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import commonjs from "@rollup/plugin-commonjs";

export default {
    input: 'builds/cdn.js',
    output: [
        {
            file: 'dist/alpine-flow.js',
            format: 'umd',
            sourcemap: true,
        },
        {
            file: 'dist/alpine-flow.min.js',
            format: 'umd',
            plugins: [terser()],
            sourcemap: true,
        }
    ],
    plugins: [
        commonjs(),
        nodeResolve(),
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
    ],
};