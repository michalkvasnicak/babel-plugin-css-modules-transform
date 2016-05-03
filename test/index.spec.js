import { expect } from 'chai';
import { resolve, join } from 'path';
import { readFileSync } from 'fs';
import gulpUtil from 'gulp-util';
import gulpBabel from 'gulp-babel';

describe('babel-plugin-css-modules-transform', () => {
    function transform(path, configuration = {}) {
        // remove css modules transform plugin (simulates clean processes)
        delete require.cache[resolve(__dirname, '../src/index.js')];
        const babel = require('babel-core');

        return babel.transformFileSync(resolve(__dirname, path), {
            plugins: [
                'transform-strict-mode',
                'transform-es2015-parameters',
                'transform-es2015-destructuring',
                'transform-es2015-modules-commonjs',
                'transform-object-rest-spread',
                'transform-es2015-spread',
                'transform-export-extensions',
                ['../../src/index.js', configuration]
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

    it('should throw if generateScopeName is not exporting a function', () => {
        expect(
            () => transform('fixtures/require.js', { generateScopedName: 'test/fixtures/generateScopedName.module.js' })
        ).to.throw(
            /^.+: Configuration '.+' is not a string or function\.$/
        );
    });

    it('should not throw if generateScopeName is exporting a function', () => {
        expect(
            () => transform('fixtures/require.js', { generateScopedName: 'test/fixtures/generateScopedName.function.module.js' })
        ).to.not.throw(
            /^.+: Configuration '.+' is not a string or function\.$/
        );
    });

    it('should throw if processCss is not a function', () => {
        expect(
            () => transform('fixtures/require.js', { processCss: 'test/fixtures/processCss.module.js' })
        ).to.throw(
            /^.+: Module '.+' does not exist or is not a function\.$/
        );
    });

    it('should throw if preprocessCss is not a function', () => {
        expect(
            () => transform('fixtures/require.js', { preprocessCss: 'test/fixtures/preprocessCss.module.js' })
        ).to.throw(
            /^.+: Module '.+' does not exist or is not a function\.$/
        );
    });

    it('should throw if append is not an array', () => {
        expect(
            () => transform('fixtures/require.js', { append: {} })
        ).to.throw(
            /^.+: Configuration '.+' has to be an array\.$/
        );
    });

    it('should throw if prepend is not an array', () => {
        expect(
            () => transform('fixtures/require.js', { prepend: {} })
        ).to.throw(
            /^.+: Configuration '.+' has to be an array\.$/
        );
    });

    it('should throw if append does not contain functions', () => {
        expect(
            () => transform('fixtures/require.js', { append: ['test/fixtures/append.module.js'] })
        ).to.throw(
            /^.+: Configuration '.+' has to be valid path to a module at index 0 or it does not export a function\.$/
        );
    });

    it('should throw if prepend does not contain functions', () => {
        expect(
            () => transform('fixtures/require.js', { prepend: ['test/fixtures/append.module.js'] })
        ).to.throw(
            /^.+: Configuration '.+' has to be valid path to a module at index 0 or it does not export a function\.$/
        );
    });

    it('should replace require call with hash of class name => css class name', () => {
        expect(transform('fixtures/require.js').code).to.be.equal(readExpected('fixtures/require.expected.js'));
        expect(transform('fixtures/import.js').code).to.be.equal(readExpected('fixtures/import.expected.js'));
    });

    it('should replace require call with hash of class name => css class name via gulp', (cb) => {
        const stream = gulpBabel({
            plugins: [
                'transform-strict-mode',
                'transform-es2015-parameters',
                'transform-es2015-destructuring',
                'transform-es2015-modules-commonjs',
                'transform-object-rest-spread',
                'transform-es2015-spread',
                'transform-export-extensions',
                ['../../src/index.js', {}]
            ]
        });

        stream.on('data', (file) => {
            expect(file.contents.toString()).to.be.equal(readExpected('fixtures/import.expected.js'));
        });

        stream.on('end', cb);

        stream.write(new gulpUtil.File({
            cwd: __dirname,
            base: join(__dirname, 'fixtures'),
            path: join(__dirname, 'fixtures/require.js'),
            contents: readFileSync(join(__dirname, 'fixtures/import.js'))
        }));

        stream.end();
    });

    it('should accept file extensions as an array', () => {
        expect(transform('fixtures/extensions.js', {extensions: ['.scss', '.css']}).code).to.be.equal(readExpected('fixtures/extensions.expected.js'));
    });
});
