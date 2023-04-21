const fs = require('fs');
const {globSync} = require('glob');
const {lexer, parser} = require('nunjucks');
const assert = require('assert');
const {TOKEN_COMMENT, TOKEN_BLOCK_START} = require('nunjucks/src/lexer');
const path = require('path');
const {LookupVal} = require('nunjucks/src/nodes');
const { parse } = require('comment-parser')

function* getNodesByType(node, type) {
    if (node === undefined) {
        return
    }

    if (node instanceof type) {
        yield node
    }

    if (node.body !== undefined) {
        yield* getNodesByType(node.body, type)
    }

    if (node.children !== undefined) {
        for (const child of node.children) {
            yield* getNodesByType(child, type)
        }
    }

    if (node.cond !== undefined) {
        yield* getNodesByType(node.cond.args, type)
        yield* getNodesByType(node.cond.left, type)
        yield* getNodesByType(node.cond.right, type)
    }
}

function validateMacro(filePath) {
    const fileContents = fs.readFileSync(filePath, {
        encoding: 'utf-8',
    })

    const tokens = lexer.lex(fileContents)
    const firstToken = tokens.nextToken()
    assert([TOKEN_COMMENT, TOKEN_BLOCK_START].includes(firstToken.type), `The file ${filePath} MUST start its first line with a code comment or the macro itself. Instead, a "${firstToken.type}" was found.`)
    const comment = firstToken.type === TOKEN_COMMENT ? firstToken : null;

    const ast = parser.parse(fileContents)
    const macro = ast.children[comment ? 1 : 0]
    const macroName = macro.name.value
    const fileName = path.basename(filePath, '.html')
    assert(macroName === fileName, `The file ${filePath} MUST contain a single macro named "${fileName}". Instead, a macro named "${macroName}" was found.`)
    assert(
        macro.args.children.length === 1 && macro.args.children[0].value === 'args',
        `The macro "${macroName}" in ${filePath} MUST take a single argument named "args".`,
    )
    const macroArgNames = Array.from(getNodesByType(ast, LookupVal))
        .filter(node => node.target.value === 'args')
        .map(node => node.val.value)

    if (macroArgNames.length > 0) {
        assert(comment !== null, `The file ${filePath} MUST contain a comment on its first line, documenting the "args." variables used in the macro.`)
    }
    if (comment) {
        const commentText = comment.value.slice(2, -2).trim()
        const jsDocComment = '/**\n'.concat(commentText.split('\n').map(line => ' * ' + line).join('\n'),  '\n */')
        const parsedComment = parse(jsDocComment)[0]
        const commentArgNames = parsedComment.tags
            .filter(comment => comment.tag === 'param')
            .map(comment => comment.name)
        const undocumentedCommentArgNames = commentArgNames.filter(name => !macroArgNames.includes(name))
        const undocumentedMacroArgNames = macroArgNames.filter(name => !commentArgNames.includes(name))
        assert(undocumentedCommentArgNames.length === 0, `The file ${filePath} documents the following arguments that are not used by the macro in the same file: ${undocumentedCommentArgNames.join(', ')}`)
        assert(undocumentedMacroArgNames.length === 0, `The file ${filePath} uses the following arguments that are not documented in the same file: ${undocumentedMacroArgNames.map(name => 'args.' + name).join(', ')}`)
    }
}

globSync([__dirname, '..', 'src', 'macros', '**', '*.html'].join('/'))
    .forEach(validateMacro)
