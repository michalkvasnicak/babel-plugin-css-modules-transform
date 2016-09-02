import { isAbsolute } from 'path';
import { statSync } from 'fs';
import { isString } from '../utils';

/**
 * Resolves mode option for css-modules-require-hook
 *
 * @param {*} value
 * @returns {boolean}
 */
export default function rootDir(value/* , currentConfig */) {
    if (!isString(value)) {
        throw new Error(`Configuration 'rootDir' is not a string`);
    }

    if (!isAbsolute(value) || !statSync(value).isDirectory()) {
        throw new Error(`Configuration 'rootDir' is not containg a valid absolute path`);
    }

    return value;
}
