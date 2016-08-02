import { resolve, dirname, basename, extname, isAbsolute, join, relative } from 'path';

import mkdirp from 'mkdirp';
// *
import { writeFileSync, appendFileSync } from 'fs';
/* /
const writeFileSync = (file, content) => {
    console.log(`Will save ${file}\n${content.replace(/^/gm, '  ')}`);
};
// */

const writeCssFile = (filename, content) => {
    mkdirp.sync(dirname(filename));
    writeFileSync(filename, content);
};
const appendCssFile = (filename, content) => {
    mkdirp.sync(dirname(filename));
    appendFileSync(filename, content);
};

const simpleRequires = [
    'createImportedName',
    'generateScopedName',
    'processCss',
    'preprocessCss'
];

const complexRequires = [
    'append',
    'prepend'
];

const defaultOptions = {
    generateScopedName: '[name]__[local]___[hash:base64:5]'
};

export default function transformCssModules({ types: t }) {
    function resolveModulePath(filename) {
        const dir = dirname(filename);
        if (isAbsolute(dir)) return dir;
        if (process.env.PWD) return resolve(process.env.PWD, dir);
        return resolve(dir);
    }

    /**
     *
     * @param {String} filepath     javascript file path
     * @param {String} cssFile      requireed css file path
     * @returns {Array} array of class names
     */
    function requireCssFile(filepath, cssFile) {
        let filePathOrModuleName = cssFile;

        // only resolve path to file when we have a file path
        if (!/^\w/i.test(filePathOrModuleName)) {
            const from = resolveModulePath(filepath);
            filePathOrModuleName = resolve(from, filePathOrModuleName);
        }
        return require(filePathOrModuleName);
    }

    // is css modules require hook initialized?
    let initialized = false;

    let matchExtensions = /\.css$/i;
    function matcher(extensions = ['.css']) {
        const extensionsPatern = extensions.join('|').replace(/\./g, '\\\.');
        return new RegExp(`(${extensionsPatern})$`, 'i');
    }

    return {
        visitor: {
            Program(path, state) {
                if (initialized) {
                    return;
                }

                const currentConfig = { ...defaultOptions, ...state.opts };
                // this is not a css-require-ook config
                delete currentConfig.extractCss;

                // match file extensions, speeds up transform by creating one
                // RegExp ahead of execution time
                matchExtensions = matcher(currentConfig.extensions);

                // Add a space in current state for css filenames
                state.$$css = {
                    styles: new Map()
                };

                const extractCssFile = (filepath, css) => {
                    const { extractCss = null } = state.opts;
                    if (!extractCss) return null;

                    // this is the case where a single extractCss is requested
                    if (typeof(extractCss) === 'string') {
                        // If this is the first file, then we should replace
                        // old content
                        if (state.$$css.styles.size === 1) {
                            return writeCssFile(extractCss, css);
                        }
                        // this should output in a single file.
                        // Let's append the new file content.
                        return appendCssFile(extractCss, css);
                    }

                    // This is the case where each css file is written in
                    // its own file.
                    const {
                        dir = 'dist',
                        filename = '[name].css',
                        relativeRoot = ''
                    } = extractCss;

                    // Make css file narmpe relative to relativeRoot
                    const relativePath = relative(
                        resolve(process.cwd(), relativeRoot),
                        filepath
                    );
                    const destination = join(
                        resolve(process.cwd(), dir),
                        filename
                    )
                        .replace(/\[name]/, basename(filepath, extname(filepath)))
                        .replace(/\[path]/, relativePath);

                    writeCssFile(destination, css);
                };

                const pushStylesCreator = (toWrap) => (css, filepath) => {
                    let processed;
                    if (typeof toWrap === 'function') {
                        processed = toWrap(css, filepath);
                    }
                    if (typeof processed !== 'string') processed = css;

                    if (!state.$$css.styles.has(filepath)) {
                        state.$$css.styles.set(filepath, processed);
                        extractCssFile(filepath, processed);
                    }

                    return processed;
                };

                // check if there are simple requires and if they are functions
                simpleRequires.forEach(key => {
                    if (typeof currentConfig[key] !== 'string') {
                        return;
                    }

                    const modulePath = resolve(process.cwd(), currentConfig[key]);

                    // this one can be require or string
                    if (key === 'generateScopedName') {
                        try {
                            // if it is existing file, require it, otherwise use value
                            currentConfig[key] = require(modulePath);
                        } catch (e) {
                            try {
                                currentConfig[key] = require(currentConfig[key]);
                            } catch (_e) {
                                // do nothing, because it is not a valid path
                            }
                        }

                        if (typeof currentConfig[key] !== 'function' && typeof currentConfig[key] !== 'string') {
                            throw new Error(`Configuration '${key}' is not a string or function.`);
                        }

                        return;
                    }

                    if (currentConfig.hasOwnProperty(key)) {
                        try {
                            currentConfig[key] = require(modulePath);
                        } catch (e) {
                            try {
                                currentConfig[key] = require(currentConfig[key]);
                            } catch (_e) {
                                // do nothing because it is not a valid path
                            }
                        }

                        if (typeof currentConfig[key] !== 'function') {
                            throw new Error(`Module '${modulePath}' does not exist or is not a function.`);
                        }
                    }
                });

                // wrap or define processCss function that collect generated css
                currentConfig.processCss = pushStylesCreator(currentConfig.processCss);

                complexRequires.forEach(key => {
                    if (!currentConfig.hasOwnProperty(key)) {
                        return;
                    }

                    if (!Array.isArray(currentConfig[key])) {
                        throw new Error(`Configuration '${key}' has to be an array.`);
                    }

                    currentConfig[key].forEach((plugin, index) => {
                        // first try to load it using npm
                        try {
                            currentConfig[key][index] = require(plugin);
                        } catch (e) {
                            try {
                                currentConfig[key][index] = require(resolve(process.cwd(), plugin));
                            } catch (_e) {
                                // do nothing
                            }
                        }

                        if (typeof currentConfig[key][index] !== 'function') {
                            throw new Error(`Configuration '${key}' has to be valid path to a module at index ${index} or it does not export a function.`);
                        }

                        currentConfig[key][index] = currentConfig[key][index]();
                    });
                });

                require('css-modules-require-hook')(currentConfig);

                initialized = true;
            },

            ImportDeclaration(path, { file }) {
                // this method is called between enter and exit, so we can map css to our state
                // it is then replaced with require call which will be handled in seconds pass by CallExpression
                // CallExpression will then replace it or remove depending on parent node (if is Program or not)
                const { value } = path.node.source;

                if (matchExtensions.test(value)) {
                    const requiringFile = file.opts.filename;
                    requireCssFile(requiringFile, value);
                }
            },

            CallExpression(path, { file }) {
                const { callee: { name: calleeName }, arguments: args } = path.node;

                if (calleeName !== 'require' || !args.length || !t.isStringLiteral(args[0])) {
                    return;
                }

                const [{ value: stylesheetPath }] = args;

                if (matchExtensions.test(stylesheetPath)) {
                    const requiringFile = file.opts.filename;
                    const tokens = requireCssFile(requiringFile, stylesheetPath);

                    // if parent expression is not a Program, replace expression with tokens
                    // Otherwise remove require from file, we just want to get generated css for our output
                    if (!t.isExpressionStatement(path.parent)) {
                        /* eslint-disable new-cap */
                        path.replaceWith(t.ObjectExpression(
                            Object.keys(tokens).map(
                                token => t.ObjectProperty(
                                    t.StringLiteral(token),
                                    t.StringLiteral(tokens[token])
                                )
                            )
                        ));
                    } else {
                        path.remove();
                    }
                }
            }
        }
    };
}
