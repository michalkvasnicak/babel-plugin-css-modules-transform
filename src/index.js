import { resolve, dirname } from 'path';

const defaultOptions = {
    generateScopedName: '[name]__[local]___[hash:base64:5]'
};

export default function transformCssModules({ types: t }) {
    return {
        visitor: {
            CallExpression(path, { file, opts }) {
                require('css-modules-require-hook')({ ...defaultOptions, ...opts });

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

                    const tokens = require(
                        resolve(process.cwd(), dirname(file.opts.filenameRelative), cssPath)
                    );

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
