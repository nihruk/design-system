'use strict'

const nunjucks = require('nunjucks');
const path = require('path');
const highlight = require('highlight.js');
const prettier = require('prettier');
const fs = require('fs');
const {lexer, parser} = require('nunjucks');
const assert = require('assert');
const {TOKEN_COMMENT} = require('nunjucks/src/lexer');
const nodes = require('nunjucks/src/nodes');
const commentParser = require('comment-parser');


const nunjucksWwwFilePageUrlPathPrefixLength = path.resolve(__dirname, '..', 'www').length
function normalizeUrlPath(urlPath) {
    if (urlPath.endsWith('index.html')) {
        urlPath = urlPath.slice(0, -10)
    }
    return '/' + urlPath.split('/')
        .filter(x => x)
        .join('/')
}

function createEnvironment() {
    const environment = new nunjucks.Environment(
        new nunjucks.FileSystemLoader(path.resolve(__dirname, '..', '..')),
        {
            throwOnUndefined: true,
        },
    )
    environment._currentPageUrlPath = null;
    environment.addFilter('highlight', (code, language) => highlight.highlight(code, {language}).value)
    environment.addFilter('prettier', (code, parser) => prettier.format(code, {parser}))
    let id = 0
    environment.addGlobal('generateId', () => `ds-id-${id++}`)
    environment.addTest('activeCurrentUrl', urlPath => {
        if (!environment._currentPageUrlPath) {
            throw new Error('No page is being templated right now.')
        }
        return environment._currentPageUrlPath === normalizeUrlPath(urlPath)
    })
    environment.addTest('activeParentUrl', urlPath => {
        if (!environment._currentPageUrlPath) {
            throw new Error('No page is being templated right now.')
        }
        return environment._currentPageUrlPath.startsWith(normalizeUrlPath(urlPath))
    })
    return environment
}

function renderFile(filename) {
    const environment = createEnvironment()
    environment._currentPageUrlPath = normalizeUrlPath(
        filename.slice(nunjucksWwwFilePageUrlPathPrefixLength)
            .split(path.sep)
            .join('/')
    )
    return environment.render(filename, {
        pageUrlPath: environment._currentPageUrlPath,
    })
}

function* getNodesByType(node, type) {
    if (node === undefined) {
        return
    }

    if (node instanceof type) {
        yield node
    }

    for (const field of ['args', 'arr', 'body', 'cond', 'left', 'right', 'value']) {
        if (node[field] !== undefined) {
            yield* getNodesByType(node[field], type)
        }
    }

    if (node.children !== undefined) {
        for (const child of node.children) {
            yield* getNodesByType(child, type)
        }
    }
}

function nunjucksJsDocCommentToJsDoc(nunjucksComment) {
    const commentText = nunjucksComment.value.slice(2, -2).trim()
    const jsDocComment = '/**\n'.concat(
        commentText
            .split('\n')
            .map(line => ' * ' + line)
            .join('\n'),
        '\n */',
    )
    return commentParser.parse(jsDocComment)[0]
}

function getMacroForFileContents(filePath, fileContents) {
    const ast = parser.parse(fileContents)
    const macros = []
    for (const macro of getNodesByType(ast, nodes.Macro)) {
        if (macro.name.value.startsWith('_')) {
            continue
        }
        macros.push(macro)
    }
    assert(macros.length === 1, `The file ${filePath} must contain exactly one public macro, but ${Object.keys(macros).length} were found.`)
    return macros[0]
}

function getMacroJsDocForFileContents(filePath, fileContents) {
    const tokens = lexer.lex(fileContents)
    let token
    while ((token = tokens.nextToken()) !== null) {
        if (token.type !== TOKEN_COMMENT) {
            continue
        }
        const jsDoc = nunjucksJsDocCommentToJsDoc(token)
        const macroTags = jsDoc.tags.filter(tag => tag.tag === 'macro')
        assert(macroTags.length <= 1, `The file ${filePath} contains a docblock with more than one @macro tag.`)
        if (macroTags.length) {
            return [macroTags[0].name, jsDoc]
        }
    }
    throw new Error(`The file ${filePath} must contain exactly one JSDoc docblock for a public macro, but none were found.`)
}

function getMacroJsDocForFilePath(filePath) {
    const fileContents = fs.readFileSync(filePath, {
        encoding: 'utf-8',
    })

    const macro = getMacroForFileContents(filePath, fileContents)
    const [jsDocMacroName, jsDoc] = getMacroJsDocForFileContents(filePath, fileContents)
    assert(macro.name.value === jsDocMacroName, `The file ${filePath} contains a macro ${macro.name.value}(), but has a "@macro ${jsDocMacroName}" docblock.`)

    const macroOptionNames = [...new Set(Array.from(getNodesByType(macro, nodes.LookupVal))
        .filter(node => node.target.value === 'options')
        .map(node => node.val.value))]
    const jsDocOptionNames = jsDoc.tags
        .filter(tag => tag.tag === 'param')
        .map(tag => tag.name)

    const undocumentedCommentOptionNames = jsDocOptionNames.filter(name => !macroOptionNames.includes(name))
    const undocumentedMacroOptionNames = macroOptionNames.filter(name => !jsDocOptionNames.includes(name))
    assert(undocumentedCommentOptionNames.length === 0, `The file ${filePath} documents the following options that are not used by the macro in the same file: ${undocumentedCommentOptionNames.join(', ')}`)
    assert(undocumentedMacroOptionNames.length === 0, `The file ${filePath} uses the following options that are not documented in the same file: ${undocumentedMacroOptionNames.map(name => 'options.' + name).join(', ')}`)

    return jsDoc
}

module.exports = {
    renderFile,
    getMacroJsDocForFilePath,
}