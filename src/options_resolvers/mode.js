import { isString } from '../utils';

/**
 * Resolves mode option for css-modules-require-hook
 *
 * @param {*} value
 * @returns {boolean}
 */
export default function mode(value/* , currentConfig */) {
    if (!isString(value)) {
        throw new Error(`Configuration 'mode' is not a string`);
    }

    return value;
}
