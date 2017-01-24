import { resolve, dirname, isAbsolute } from 'path';

// options resolvers
import * as requireHooksOptions from './options_resolvers';

// utils.
import { extractCssFile } from './utils';

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

        // css-modules-require-hooks throws if file is ignored
        try {
            return require(filePathOrModuleName);
        } catch (e) {
            return {}; // return empty object, this simulates result of ignored stylesheet file
        }
    }

    // is css modules require hook initialized?
    let initialized = false;

    let matchExtensions = /\.css$/i;

    function matcher(extensions = ['.css']) {
        const extensionsPattern = extensions.join('|').replace(/\./g, '\\\.');
        return new RegExp(`(${extensionsPattern})$`, 'i');
    }

    function buildClassNameToScopeNameMap(tokens) {
        /* eslint-disable new-cap */
        return t.ObjectExpression(
            Object.keys(tokens).map(token =>
                t.ObjectProperty(
                    t.StringLiteral(token),
                    t.StringLiteral(tokens[token])
                )
            )
        );
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

                const pushStylesCreator = (toWrap) => (css, filepath) => {
                    let processed;

                    if (typeof toWrap === 'function') {
                        processed = toWrap(css, filepath);
                    }

                    if (typeof processed !== 'string') processed = css;

                    if (!state.$$css.styles.has(filepath)) {
                        state.$$css.styles.set(filepath, processed);
                        extractCssFile(process.cwd(), filepath, processed, state);
                    }

                    return processed;
                };

                // resolve options
                Object.keys(requireHooksOptions).forEach(key => {
                    // skip undefined options
                    if (currentConfig[key] === undefined) {
                        return;
                    }

                    currentConfig[key] = requireHooksOptions[key](currentConfig[key], currentConfig);
                });

                // wrap or define processCss function that collect generated css
                currentConfig.processCss = pushStylesCreator(currentConfig.processCss);

                require('css-modules-require-hook')(currentConfig);

                initialized = true;
            },

            ImportDefaultSpecifier(path, { file }) {
                const { value } = path.parentPath.node.source;

                if (matchExtensions.test(value)) {
                    const requiringFile = file.opts.filename;
                    const tokens = requireCssFile(requiringFile, value);

                    path.parentPath.replaceWith(
                        t.variableDeclaration('var', [
                            t.variableDeclarator(
                                t.identifier(path.node.local.name),
                                buildClassNameToScopeNameMap(tokens)
                            )
                        ]),
                    );
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
                        path.replaceWith(buildClassNameToScopeNameMap(tokens));
                    } else {
                        path.remove();
                    }
                }
            }
        }
    };
}
