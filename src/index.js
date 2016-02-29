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

    return {
        visitor: {
            CallExpression(path, { file, opts }) {
                const currentConfig = { ...defaultOptions, ...opts };

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

                const { callee: { name: calleeName }, arguments: args } = path.node;

                if (calleeName !== 'require' || !args.length || !t.isStringLiteral(args[0])) {
                    return;
                }

                if (/\.css/i.test(args[0].value)) {
                    const [ { value: cssPath }] = args;

                    // if parent expression is variable declarator, replace right side with tokens
                    if (!t.isVariableDeclarator(path.parent)) {
                        throw new Error(
                            `You can't import css file ${cssPath} to a module scope.`
                        );
                    }

                    const from = resolveModulePath(file.opts.filename);
                    const tokens = require(resolve(from, cssPath));

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
