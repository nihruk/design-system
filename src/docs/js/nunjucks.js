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
const marked = require('marked');
const {SafeString} = require("nunjucks/src/runtime");


const _colours = [
    {
        'label': 'Navy',
        'name': 'navy',
        'tints': [
            {
                'hex': '193E72',
                'specialMeaning': {
                    'name': 'primary',
                    'label': 'NIHR primary colour'
                }
            },
            {
                'hex': '475989'
            },
            {
                'hex': '747CA3'
            },
            {
                'hex': 'A2A4C1'
            },
            {
                'hex': 'D0D0E0'
            }
        ]
    },
    {
        'label': 'Black',
        'name': 'black',
        'tints': [
            {
                'hex': '1D1D1B'
            },
            {
                'hex': '575656'
            },
            {
                'hex': '878786'
            },
            {
                'hex': 'B3B2B2'
            },
            {
                'hex': 'DADADA'
            }
        ]
    },
    {
        'label': 'Coral',
        'name': 'coral',
        'tints': [
            {
                'hex': 'EA5D4E',
                'specialMeaning': {
                    'name': 'attention',
                    'label': 'attention'
                }
            },
            {
                'hex': 'EF826E'
            },
            {
                'hex': 'F3A491'
            },
            {
                'hex': 'F8C5B6'
            },
            {
                'hex': 'FCE3DA'
            }
        ]
    },
    {
        'label': 'Orange',
        'name': 'orange',
        'tints': [
            {
                'hex': 'F29330'
            },
            {
                'hex': 'F6AB5D'
            },
            {
                'hex': 'F9C187'
            },
            {
                'hex': 'FCD6B0'
            },
            {
                'hex': 'FDEBD8'
            }
        ]
    },
    {
        'label': 'Yellow',
        'name': 'yellow',
        'tints': [
            {
                'hex': 'FED47A',
                'specialMeaning': {
                    'name': 'focus',
                    'label': 'interaction focus'
                }
            },
            {
                'hex': 'FFDC98'
            },
            {
                'hex': 'FEE5AF'
            },
            {
                'hex': 'FFEECA'
            },
            {
                'hex': 'FFF6E6'
            }
        ]
    },
    {
        'label': 'Purple',
        'name': 'purple',
        'tints': [
            {
                'hex': '6567AD'
            },
            {
                'hex': '8482BE'
            },
            {
                'hex': 'A2A0D0'
            },
            {
                'hex': 'C1BFE1'
            },
            {
                'hex': 'E0DFF1'
            }
        ]
    },
    {
        'label': 'Aqua',
        'name': 'aqua',
        'tints': [
            {
                'hex': '2EA9B0'
            },
            {
                'hex': '6FBAC0'
            },
            {
                'hex': '82CBD0'
            },
            {
                'hex': 'ABDDDF'
            },
            {
                'hex': 'E1EEF0'
            }
        ]
    },
    {
        'label': 'Green',
        'name': 'green',
        'tints': [
            {
                'hex': '45A86C'
            },
            {
                'hex': '79B989'
            },
            {
                'hex': '8CCBA7'
            },
            {
                'hex': 'B5DCC4'
            },
            {
                'hex': 'E2EEE3'
            }
        ]
    },
    {
        'label': 'Grey',
        'name': 'grey',
        'tints': [
            {
                'hex': 'ACBCC4'
            },
            {
                'hex': 'BDC9CF'
            },
            {
                'hex': 'CED6DB'
            },
            {
                'hex': 'DFE3E7'
            },
            {
                'hex': 'EFF1F3'
            }
        ]
    }
]

function normalizeUrlPath(urlPath) {
    if (urlPath.endsWith('index.html')) {
        urlPath = urlPath.slice(0, -10)
    }
    return '/' + urlPath.split('/')
        .filter(x => x)
        .join('/')
}

const deindentIndentationPattern = /^[ \t]*(?=\S)/gm

function deindent(value) {
    const match = value.match(deindentIndentationPattern)
    const indentation = match ? match.reduce((r, a) => Math.min(r, a.length), Infinity) : 0
    if (indentation === 0) {
        return value
    }
    const deindentationPattern = new RegExp(`^[ \\t]{${indentation}}`, 'gm')
    return value.replace(deindentationPattern, '')
}

const nunjucksWwwFilePageUrlPathPrefixLength = path.resolve(__dirname, '..', 'www').length

class Environment extends nunjucks.Environment {
    constructor(assetEmitterPlugin, _parentEnvironment = null) {
        super(
            new nunjucks.FileSystemLoader(path.resolve(__dirname, '..', '..')),
            {
                noCache: true,
                throwOnUndefined: true,
            },
        )
        const environment = this
        this._parentEnvironment = _parentEnvironment
        this._assetEmitterPlugin = assetEmitterPlugin
        this._lastGeneratedId = 0
        this._currentPageUrlPath = null;
        this._renderedHtmlExampleIds = []
        this.addFilter('consoleLog', (...args) => {
            console.log(...args)
            // Nunjucks expects all filters to return a non-null value.
            return ''
        })
        this.addGlobal('_colours', _colours)
        this.addFilter('renderHtmlExample', (renderableHtmlExample, exampleOptions) => environment.renderHtmlExample(renderableHtmlExample, exampleOptions))
        this.addFilter('deindent', deindent)
        this.addFilter('kebabCaseToLowerCamelCase', value => value.replace(/-./g, x => x[1].toUpperCase()))
        this.addFilter('setKey', (mapping, key, value) => {
            mapping[key] = value
        })
        this.addFilter('highlight', (code, language) => highlight.highlight(code, {language}).value)
        this.addFilter('prettier', (code, parser) => prettier.format(code, {parser}))
        this.addGlobal('generateId', () => environment.generateId())
        this.addFilter('markdown', marked.parse)
        this.addFilter('nunjucks', code => environment.renderStringInChildEnvironment(code))
        this.addFilter('nunjucksMacroJsDocs', name => getMacroJsDocForFilePath(path.join(__dirname, '..', '..', 'macros', ...name.split('/')) + '.html'))
        this.addFilter('htmlAttributes', attributes => {
            let renderedAttributes = ' '
            for (let [name, value] of Object.entries(attributes)) {
                if (typeof value !== 'string') {
                    value = value.join(' ')
                }
                if (value) {
                    renderedAttributes += ` ${name}="${value}"`
                }
            }
            return new SafeString(renderedAttributes.trimEnd())
        })
        this.addTest('activeCurrentUrl', urlPath => {
            if (!environment._currentPageUrlPath) {
                throw new Error('No page is being templated right now.')
            }
            return environment._currentPageUrlPath === normalizeUrlPath(urlPath)
        })
        this.addTest('activeParentUrl', urlPath => {
            if (!environment._currentPageUrlPath) {
                throw new Error('No page is being templated right now.')
            }
            return environment._currentPageUrlPath.startsWith(normalizeUrlPath(urlPath))
        })
    }

    renderHtmlExample(renderableHtmlExample, exampleOptions) {
        assert(exampleOptions.id !== undefined)
        const directoryNames = ['_docs_html_examples', exampleOptions.id]
        if (!this._renderedHtmlExampleIds.includes(exampleOptions.id)) {
            this._renderedHtmlExampleIds.push(exampleOptions.id)
            const pageTemplate = exampleOptions.pageTemplate === undefined ? 'docs/partials/example/rendered-html--page.html' : exampleOptions.pageTemplate
            this.emitAsset(
                path.join(...directoryNames, 'index.html'),
                pageTemplate ? this.render(pageTemplate, {
                    options: exampleOptions,
                    renderableHtmlExample,
                }) : renderableHtmlExample.code,
            )
        }
        return '/' + directoryNames.join('/')

    }

    createChildEnvironment() {
        return new Environment(this._assetEmitterPlugin, this)
    }

    emitAsset(path, content) {
        if (this._parentEnvironment) {
            return this._parentEnvironment.emitAsset(path, content)
        }
        this._assetEmitterPlugin.emit(path, content)
    }

    generateId() {
        if (this._parentEnvironment) {
            return this._parentEnvironment.generateId()
        }
        return 'ds-id-' + this._lastGeneratedId++
    }

    renderStringInChildEnvironment(code) {
        return this.createChildEnvironment().renderString(code)
    }

    renderPageFile(filename) {
        this._currentPageUrlPath = normalizeUrlPath(
            filename.slice(nunjucksWwwFilePageUrlPathPrefixLength)
                .split(path.sep)
                .join('/')
        )
        return this.render(filename, {
            pageUrlPath: this._currentPageUrlPath,
        })
    }
}

function* getNodesByType(node, type) {
    if (!node) {
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
    const commentText = nunjucksComment.value.slice(2, -2)
    const jsDocComment = '/**\n'.concat(
        commentText
            .split('\n')
            .map(line => ' * ' + line)
            .join('\n'),
        '\n */',
    )
    return commentParser.parse(jsDocComment, {
        spacing: 'preserve',
    })[0]
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

    return jsDoc
}

module.exports = {
    Environment,
    getMacroJsDocForFilePath,
}
