import { isModulePath, isPlainObject, requireLocalFileOrNodeModule } from '../utils';

/**
 * Resolves processOpts option for css-modules-require-hook
 *
 * @param {String|Function} value
 *
 * @returns {String|Function}
 */
export default function processOpts(value/* ,currentConfig */) {
    if (isModulePath(value)) {
        const requiredModule = requireLocalFileOrNodeModule(value);

        if (isPlainObject(requiredModule)) {
            return requiredModule;
        }

        throw new Error(`Configuration file for 'processOpts' is not exporting a plain object`);
    } else if (isPlainObject(value)) {
        return value;
    } else {
        throw new Error(`Configuration 'processOpts' is not a plain object nor a valid path to module`);
    }
}
