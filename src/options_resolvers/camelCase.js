import { isBoolean } from '../utils';

/**
 * Resolves camelCase option for css-modules-require-hook
 *
 * @param {*} value
 * @returns {boolean}
 */
export default function camelCase(value/* , currentConfig */) {
    if (!isBoolean(value)) {
        throw new Error(`Configuration 'camelCase' is not a boolean`);
    }

    return value;
}
