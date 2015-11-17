const babel = require('babel-core');
import { expect } from 'chai';
import { resolve } from 'path';
import { readFileSync } from 'fs';

describe('babel-plugin-css-modules-transform', () => {
    function transform(path) {
        return babel.transformFileSync(resolve(__dirname, path), {
            plugins: [
                'transform-strict-mode',
                'transform-es2015-parameters',
                'transform-es2015-destructuring',
                'transform-es2015-modules-commonjs',
                'transform-object-rest-spread',
                'transform-es2015-spread',
                'transform-export-extensions',
                '../src/index.js'
            ]
        });
    }

    function readExpected(path) {
        return readFileSync(resolve(__dirname, path), 'utf8');
    }

    it('should throw if we are requiring css module to module scope', () => {
        expect(() => transform('fixtures/global.require.js')).to.throw(
            /^.+: You can't import css file .+ to a module scope\.$/
        );

        expect(() => transform('fixtures/global.import.js')).to.throw(
            /^.+: You can't import css file .+ to a module scope\.$/
        );
    });

    it('should replace require call with hash of class name => css class name', () => {
        expect(transform('fixtures/require.js').code).to.be.equal(readExpected('fixtures/require.expected.js'));
        expect(transform('fixtures/import.js').code).to.be.equal(readExpected('fixtures/import.expected.js'));
    });

});
