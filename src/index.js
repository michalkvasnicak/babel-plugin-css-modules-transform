import { resolve, dirname, isAbsolute } from 'path';

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
        const from = resolveModulePath(filepath);
        return require(resolve(from, cssFile));
    }

    return {
        visitor: {
            Program: {
                enter(path, state) {
                    state.$$css = {
                        styles: new Map()
                    };

                    const { extensions = ['.css'] } = state.opts;

                    if (!Array.isArray(extensions)) {
                        throw new Error('Extensions configurations has to be an array');
                    }

                    state.$$css.extensions = new RegExp(`(${extensions.join('|').replace('.', '\\.')})$`, 'i');

                    // initialize css modules require hook
                    const currentConfig = { ...defaultOptions, ...state.opts };

                    const pushStylesCreator = (toWrap) => (css, filepath) => {
                        if (!state.$$css.styles.has(filepath)) {
                            state.$$css.styles.set(filepath, css);
                        }

                        if (typeof toWrap === 'function') {
                            return toWrap(css, filepath);
                        }
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

                            // if processCss is name of configuration key, then wrap it to own function
                            // otherwise it will be just defined
                            if (key === 'processCss') {
                                currentConfig[key] = pushStylesCreator(currentConfig[key]);
                            }
                        }
                    });

                    // if processCss is not defined, define it
                    if (typeof currentConfig.processCss === 'undefined') {
                        currentConfig.processCss = pushStylesCreator();
                    }

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
                                    currentConfig[key][index] = require(resolve(process.cwd(), path));
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
                },

                /* eslint-disable no-unused-vars */
                exit(path, state) {
                    // todo extract to files / file (propably needs appending in case of single file because exit is called for each js file)
                }
            },

            ImportDeclaration(path, { file, $$css: { extensions }}) {
                // this method is called between enter and exit, so we can map css to our state
                // it is then replaced with require call which will be handled in seconds pass by CallExpression
                // CallExpression will then replace it or remove depending on parent node (if is Program or not)
                const { value } = path.node.source;

                // do nothing if not known extension
                if (!extensions.exec(value)) {
                    return;
                }

                requireCssFile(file.opts.filename, value);
            },

            CallExpression(path, { file, $$css: { extensions } }) {
                const { callee: { name: calleeName }, arguments: args } = path.node;

                if (calleeName !== 'require' || !args.length || !t.isStringLiteral(args[0])) {
                    return;
                }

                // if we are not requiring css, ignore
                if (!extensions.exec(args[0].value)) {
                    return;
                }

                // if parent expression is not a variable declarator, just remove require from file
                // we just want to get generated css for our output
                const tokens = requireCssFile(file.opts.filename, args[0].value);

                // if parent expression is not a Program, replace expression with tokens
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
    };
}
