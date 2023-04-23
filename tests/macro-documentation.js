'use strict'

const {globSync} = require('glob')
const {getMacroJsDocForFilePath} = require("../src/docs/js/nunjucks")

globSync([
    [__dirname, '..', 'src', 'macros', '**', '[!_]*.html'].join('/'),
    [__dirname, '..', 'src', 'docs', 'macros', '**', '[!_]*.html'].join('/'),
]).forEach(getMacroJsDocForFilePath)
