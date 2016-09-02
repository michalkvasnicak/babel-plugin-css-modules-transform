require('babel-register')({
    ignore: /(src\/utils\/processCss\.js|node_modules|build)/
});

require('./index');
