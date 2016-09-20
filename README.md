# babel-plugin-css-modules-transform [Babel 6 only]

[![Circle CI](https://circleci.com/gh/michalkvasnicak/babel-plugin-css-modules-transform.svg?style=svg)](https://circleci.com/gh/michalkvasnicak/babel-plugin-css-modules-transform)

This Babel plugin finds all `require`s for css module files and replace them with a hash where keys are class names and values are generated css class names.

This plugin is based on the fantastic [css-modules-require-hook](https://github.com/css-modules/css-modules-require-hook).

## Warning

This plugin is experimental, pull requests are welcome.

**Do not run this plugin as part of webpack frontend configuration. This plugin is intended only for backend compilation.**

## Example

```css
/* test.css */

.someClass {
    color: red;
}
```

```js
// component.js
const styles = require('./test.css');

console.log(styles.someClass);

// transformed file
const styles = {
    'someClass': 'Test__someClass___2Frqu'
}

console.log(styles.someClass); // prints Test__someClass___2Frqu
```

## Installation

```
npm install --save-dev babel-plugin-css-modules-transform
```

**Include plugin in `.babelrc`**

```json
{
    "plugins": ["css-modules-transform"]
}
```

**With custom options [css-modules-require-hook options](https://github.com/css-modules/css-modules-require-hook#tuning-options)**


```js
{
    "plugins": [
        [
            "css-modules-transform", {
                "append": [
                    "npm-module-name",
                    "./path/to/module-exporting-a-function.js"
                ],
                "camelCase": false,
                "createImportedName": "npm-module-name",
                "createImportedName": "./path/to/module-exporting-a-function.js",
                "devMode": false,
                "extensions": [".css", ".scss", ".less"], // list extensions to process; defaults to .css
                "generateScopedName": "[name]__[local]___[hash:base64:5]", // in case you don't want to use a function
                "generateScopedName": "./path/to/module-exporting-a-function.js", // in case you want to use a function
                "generateScopedName": "npm-module-name",
                "hashPrefix": "string",
                "ignore": "*css",
                "ignore": "./path/to/module-exporting-a-function-or-regexp.js",
                "preprocessCss": "./path/to/module-exporting-a-function.js",
                "preprocessCss": "npm-module-name",
                "processCss": "./path/to/module-exporting-a-function.js",
                "processCss": "npm-module-name",
                "processOpts": "npm-module-name",
                "processOpts": "./path/to/module/exporting-a-plain-object.js",
                "mode": "string",
                "prepend": [
                    "npm-module-name",
                    "./path/to/module-exporting-a-function.js"
                ],
                "extractCss": "./dist/stylesheets/combined.css"
            }
        ]
    ]
}
```

## Using a preprocessor

When using this plugin with a preprocessor, you'll need to configure it as such:


```
// ./path/to/module-exporting-a-function.js
var sass = require('node-sass');
var path = require('path');

module.exports = function processSass(data, filename) {
    var result;
    result = sass.renderSync({
        data: data,
        file: filename
    }).css;
    return result.toString('utf8');
};
```

and then add any relevant extensions to your plugin config:

```
{
    "plugins": [
        [
            "css-modules-transform", {
                "preprocessCss": "./path/to/module-exporting-a-function.js",
                "extensions": [".css", ".scss"]
            }
        ]
    ]
}

```

## Extract CSS Files

When you publish a library, you might want to ship compiled css files as well to
help integration in other projects.

An more complete alternative is to use
[babel-plugin-webpack-loaders](https://github.com/istarkov/babel-plugin-webpack-loaders)
but be aware that a new webpack instance is run for each css file, this has a
huge overhead. If you do not use fancy stuff, you might consider using
[babel-plugin-css-modules-transform](https://github.com/michalkvasnicak/babel-plugin-css-modules-transform)
instead.


To combine all css files in a single file, give its name:

```
{
    "plugins": [
        [
            "css-modules-transform", {
                "extractCss": "./dist/stylesheets/combined.css"
            }
        ]
    ]
}
```

To extract all files in a single directory, give an object:

```
{
    "plugins": [
        [
            "css-modules-transform", {
                "extractCss": {
                    "dir": "./dist/stylesheets/",
                    "relativeRoot": "./src/",
                    "filename": "[path]/[name].css"
                }
            }
        ]
    ]
}
```

Note that `relativeRoot` is used to resolve relative directory names, available
as `[path]` in `filename` pattern.

## Using a `babel-register`

Make sure you set `ignore` option of `babel-register` to ignore all files used by css-modules-require-hook to process your css files.

**Require `babel-register` only once otherwise it will fail**
**Be aware, you need to explicitly ignore `node_modules` if you set `ignore` option**

```js
require('babel-register')({
    ignore: /(processCss\.js|node_modules)/ // regex matching all files used by css-modules-require-hook to process your css files
})
```

## Using in mocha

Create a js file with content

**Be aware, you need to explicitly ignore `node_modules` if you set `ignore` option**

```js
require('babel-register')({
    ignore: /(processCss\.js|node_modules)/ // regex matching all files used by css-modules-require-hook to process your css files
})
```

and then set this file as a compiler `--compilers js:<name-of-your-file>.js`

## License

MIT
