import writeCssFile from './writeCssFile';
import { basename, dirname, extname, join, relative, resolve } from 'path';

export const PATH_VARIABLES = ['[path]', '[name]'];

/**
 * Extracts CSS to file
 *
 * @param {String} cwd
 * @param {String} filepath
 * @param {String} css
 * @param {Object} state
 * @returns {null}
 */
export default function extractCssFile(cwd, filepath, css, state) {
    const { extractCss = null } = state.opts;

    if (!extractCss) {
        return null;
    }

    // this is the case where a single extractCss is requested
    if (typeof(extractCss) === 'string') {
        // check if extractCss contains some from pattern variables, if yes throw!
        PATH_VARIABLES.forEach(VARIABLE => {
            if (extractCss.indexOf(VARIABLE) !== -1) {
                throw new Error('extractCss cannot contain variables');
            }
        });

        // If this is the first file, then we should replace
        // old content
        if (state.$$css.styles.size === 1) {
            return writeCssFile(extractCss, css);
        }

        // this should output in a single file.
        // Let's append the new file content.
        return writeCssFile(extractCss, css, true);
    }

    // This is the case where each css file is written in
    // its own file.
    const {
        dir = 'dist',
        filename = '[name].css',
        relativeRoot = ''
    } = extractCss;

    // check if filename contains at least [name] variable
    if (filename.indexOf('[name]') === -1) {
        throw new Error('[name] variable has to be used in extractCss.filename option');
    }

    // Make css file name relative to relativeRoot
    const relativePath = relative(
        resolve(cwd, relativeRoot),
        filepath
    );

    const destination = join(
        resolve(cwd, dir),
        filename
    )
        .replace(/\[name]/, basename(filepath, extname(filepath)))
        .replace(/\[path]/, dirname(relativePath));

    writeCssFile(destination, css);
}
