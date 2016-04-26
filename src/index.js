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

    let matchExtensions = /\.css/i;
    function matcher(extensions = ['.css']) {
        const extensionsPatern = extensions.join('|').replace('.', '\.');
        return new RegExp(`(${extensionsPatern})`, 'i');
    }

    return {
        visitor: {
            Program(path, { opts }) {
                if (initialized) {
                    return;
                }

                const currentConfig = { ...defaultOptions, ...opts };

                // match file extensions, speeds up transform by creating one
                // RegExp ahead of execution time
                matchExtensions = matcher(currentConfig.extensions);

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

            CallExpression(path, { file }) {
                const { callee: { name: calleeName }, arguments: args } = path.node;

                if (calleeName !== 'require' || !args.length || !t.isStringLiteral(args[0])) {
                    return;
                }

                const [{ value: stylesheetPath }] = args;

                if (matchExtensions.test(stylesheetPath)) {
                    // if parent expression is variable declarator, replace right side with tokens
                    if (!t.isVariableDeclarator(path.parent)) {
                        throw new Error(
                            `You can't import css file ${stylesheetPath} to a module scope.`
                        );
                    }

                    const requiringFile = file.opts.filename;
                    const tokens = requireCssFile(requiringFile, stylesheetPath);

                    /* eslint-disable new-cap */
                    path.replaceWith(t.ObjectExpression(
                            Object.keys(tokens).map(
                                token => t.ObjectProperty(
                                t.StringLiteral(token),
                                t.StringLiteral(tokens[token])
                            )
                        )
                    ));
                }
            }
        }
    };
}
