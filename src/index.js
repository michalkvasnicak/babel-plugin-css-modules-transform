import { resolve, dirname, isAbsolute } from 'path';

// options resolvers
import * as requireHooksOptions from './options_resolvers';

// utils.
import { extractCssFile } from './utils';

const defaultOptions = {
    generateScopedName: '[name]__[local]___[hash:base64:5]'
};

function findExpressionStatementChild(path, t) {
    const parent = path.parentPath;
    if (!parent) {
        throw new Error('Invalid expression structure');
    }
    if (
    t.isExpressionStatement(parent)
    || t.isProgram(parent)
    || t.isBlockStatement(parent)
  ) {
        return path;
    }
    return findExpressionStatementChild(parent, t);
}

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
    // are we requiring a module for preprocessCss, processCss, etc?
    // we don't want them to be transformed using this plugin
    // because it will cause circular dependency in babel-node and babel-register process
    let inProcessingFunction = false;

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

    const cssMap = new Map();
    let thisPluginOptions = null;

    const pluginApi = {
        manipulateOptions(options) {
            if (initialized || inProcessingFunction) {
                return options;
            }

            // find options for this plugin
            // we have to use this hack because plugin.key does not have to be 'css-modules-transform'
            // so we will identify it by comparing manipulateOptions
            thisPluginOptions = options.plugins.filter(
              ([plugin]) => plugin.manipulateOptions === pluginApi.manipulateOptions
            )[0][1];

            const currentConfig = { ...defaultOptions, ...thisPluginOptions };
            // this is not a css-require-ook config
            delete currentConfig.extractCss;

            // match file extensions, speeds up transform by creating one
            // RegExp ahead of execution time
            matchExtensions = matcher(currentConfig.extensions);

            const pushStylesCreator = (toWrap) => (css, filepath) => {
                let processed;

                if (typeof toWrap === 'function') {
                    processed = toWrap(css, filepath);
                }

                if (typeof processed !== 'string') processed = css;

                // set css content only if is new
                if (!cssMap.has(filepath) || cssMap.get(filepath) !== processed) {
                    cssMap.set(filepath, processed);
                }

                return processed;
            };

            // Build arguments especially for css-modules-require-hook
            // because it has arguments validator and any external
            // option will result in a error
            const requireHooksArguments = {};
            // resolve options
            Object.keys(requireHooksOptions).forEach(key => {
                // skip undefined options
                if (currentConfig[key] === undefined) {
                    return;
                }

                inProcessingFunction = true;
                requireHooksArguments[key] = requireHooksOptions[key](currentConfig[key], currentConfig);
                inProcessingFunction = false;
            });

            // wrap or define processCss function that collect generated css
            requireHooksArguments.processCss = pushStylesCreator(currentConfig.processCss);

            require('css-modules-require-hook')(requireHooksArguments);

            initialized = true;

            return options;
        },
        post() {
            // extract css only if is this option set
            if (thisPluginOptions && thisPluginOptions.extractCss) {
                // always rewrite file :-/
                extractCssFile(
                    process.cwd(),
                    cssMap,
                    thisPluginOptions.extractCss
                );
            }
        },
        visitor: {
            // import styles from './style.css';
            ImportDefaultSpecifier(path, { file }) {
                const { value } = path.parentPath.node.source;

                if (matchExtensions.test(value)) {
                    const requiringFile = file.opts.filename;
                    const tokens = requireCssFile(requiringFile, value);

                    const varDeclaration = t.variableDeclaration('var', [t.variableDeclarator(t.identifier(path.node.local.name), buildClassNameToScopeNameMap(tokens))]);

                    if (thisPluginOptions.keepImport) {
                        path.parentPath.replaceWithMultiple([
                            t.importDeclaration([], t.stringLiteral(value)),
                            varDeclaration
                        ]);
                    } else {
                        path.parentPath.replaceWith(varDeclaration);
                    }
                }
            },

            // const styles = require('./styles.css');
            CallExpression(path, { file }) {
                const { callee: { name: calleeName }, arguments: args } = path.node;

                if (
                  calleeName !== 'require'
                  || !args.length
                  || !t.isStringLiteral(args[0])
                  // Should keep expression placed in Program or block
                  // because modular css without assignment to the variable
                  // has makes no sense
                  || (
                    t.isProgram(path.parentPath)
                    || t.isBlockStatement(path.parentPath)
                  )
                ) {
                    return;
                }

                const [{ value: stylesheetPath }] = args;

                if (matchExtensions.test(stylesheetPath)) {
                    const requiringFile = file.opts.filename;
                    const tokens = requireCssFile(requiringFile, stylesheetPath);

                    // if parent expression is not a Program, replace expression with tokens
                    // Otherwise remove require from file, we just want to get generated css for our output
                    // or keep if `keepImport` option enabled
                    if (!t.isExpressionStatement(path.parent)) {
                        path.replaceWith(buildClassNameToScopeNameMap(tokens));
                        // Keeped import will places before closest expression statement child
                        if (thisPluginOptions.keepImport) {
                            findExpressionStatementChild(path, t).insertBefore(t.expressionStatement(
                            t.callExpression(
                              t.identifier('require'),
                              [t.stringLiteral(stylesheetPath)]
                            )
                          ));
                        }
                    } else {
                        if (!thisPluginOptions.keepImport) {
                            path.remove();
                        }
                    }
                }
            }
        }
    };

    return pluginApi;
}
