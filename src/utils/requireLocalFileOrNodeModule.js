import { resolve as resolvePath } from 'path';

/**
 * Require local file or node modules
 *
 * @param {String} path
 * @returns {*}
 */
export default function requireLocalFileOrNodeModule(path) {
    const localFile = resolvePath(process.cwd(), path);

    try {
        // first try to require local file
        console.log('local file', localFile);
        return require(localFile);
    } catch (e) {
        console.log('local file error', e);
        // try to require node_module
        console.log('npm module', path);
        return require(path);
    }
}
