import { espace } from '../lib/espace.min.mjs'

import { getHash } from '../core/hash.mjs'


function expectIdentifier (tree, message) {
    if (tree.token.type !== 'identifier') {
        throw message
    }
}

function expectNumber (tree, message) {
    if (tree.token.type !== 'number') {
        throw message
    }
}

function expectString (tree, message) {
    if (tree.token.type !== 'string') {
        throw message
    }
}

function expectList (tree, message) {
    if (tree.token.type !== 'open') {
        throw message
    }
}

function expectForm (tree, message) {
    if (
        tree.token.type !== 'open' ||
        tree.children.length === 0 ||
        tree.children[0].token.type !== 'identifier'
    ) {
        throw message
    }
}

function expectChildCount (children, length, message) {
    if (children.length !== length) {
        throw message
    }
}

function makeBinaryOperation (children, context) {
    expectChildCount(children, 3, 'expected 2 operands')

    return {
        type: 'binary-op',
        operator: children[0].token.value,
        operand1: buildExpression(children[1], context),
        operand2: buildExpression(children[2], context),
    }
}

function makeUnaryOperation (children, context) {
    expectChildCount(children, 2, 'expected 1 operand')

    return {
        type: 'unary-op',
        operator: children[0].token.value,
        operand: buildExpression(children[1], context),
    }
}

function makeAt (children, context) {
    expectChildCount(children, 3, 'expected base and offset expressions')

    return {
        type: 'subscript',
        base: buildExpression(children[1], context),
        offset: buildExpression(children[2], context),
    }
}

function makeAssignment (children, context) {
    expectChildCount(children, 3, 'expected left and right expressions')

    return {
        type: 'assignment',
        left: buildExpression(children[1], context),
        right: buildExpression(children[2], context),
    }
}

function makeInc (children, context) {
    expectChildCount(children, 2, 'expected an expression')

    return {
        type: 'inc',
        singlet: buildExpression(children[1], context),
    }
}

function makeDec (children, context) {
    expectChildCount(children, 2, 'expected an expression')

    return {
        type: 'dec',
        singlet: buildExpression(children[1], context),
    }
}

const makersMap = new Map([
    ['+', makeBinaryOperation],
    ['-', makeBinaryOperation],
    ['*', makeBinaryOperation],
    ['/', makeBinaryOperation],
    ['%', makeBinaryOperation],

    ['bitAnd', makeBinaryOperation],
    ['bitOr', makeBinaryOperation],
    ['bitXor', makeBinaryOperation],

    ['not', makeUnaryOperation],
    ['bitNot', makeUnaryOperation],

    ['at', makeAt],
    ['set', makeAssignment],

    ['inc', makeInc],
    ['dec', makeDec],

    ['<', makeBinaryOperation],
    ['<=', makeBinaryOperation],
    ['==', makeBinaryOperation],
    ['>=', makeBinaryOperation],
    ['>', makeBinaryOperation],
    ['!=', makeBinaryOperation],
])

function buildCall (tree, context) {
    const first = tree.children[0]

    if (first.token.type === 'identifier' && makersMap.has(first.token.value)) {
        const maker = makersMap.get(first.token.value)
        return maker(tree.children, context)
    }

    const calee = buildExpression(first, context)

    const args = []
    for (let i = 1; i < tree.children.length; i++) {
        args.push(buildExpression(tree.children[i], context))
    }

    return {
        type: 'call',
        calee,
        args,
    }
}

function buildExpression (tree, context) {
    switch (tree.token.type) {
        case 'number':
            return {
                type: 'literal',
                value: tree.token.value,
            }

        case 'identifier':
            const name = tree.token.value

            if (name.includes('::')) {
                const parts = name.split('::')
                const nameMangled = `${context.namespaceToHash.get(parts[0])}_${parts[1]}`

                context.importRefs.push(nameMangled) // duplicates??

                return {
                    type: 'identifier',
                    name: nameMangled,
                    nameOriginal: name,
                }
            } else {
                return {
                    type: 'identifier',
                    name,
                }
            }

        case 'open':
            return buildCall(tree, context)
    }
}

function buildStatement (tree, context) {
    expectForm(tree, 'expecting a statement')

    const first = tree.children[0]

    if (first.token.type === 'open') {
        return buildCall(first, context)
    }

    expectIdentifier(first, 'expecting a statement')

    switch (first.token.value) {
        case 'do':
            const statements = []

            for (let i = 1; i < tree.children.length; i++) {
                statements.push(buildStatement(tree.children[i], context))
            }

            return {
                type: 'do',
                statements,
            }

        case 'var':
            if (tree.children.length < 2) {
                throw 'variable must have a name'
            } else if (tree.children.length > 3) {
                throw '(var name value)'
            }

            expectIdentifier(tree.children[1], 'variable name must be an identifier')

            const name = tree.children[1].token.value
            context.vars.push({ name })

            if (tree.children.length === 3) {
                return {
                    type: 'assignment',
                    left: { type: 'identifier', name },
                    right: buildExpression(tree.children[2], context),
                }
            }

            return { type: 'nop' }

        case 'return':
            if (context.funs != null) {
                throw 'can only return from functions or procedures'
            }

            if (context.fun) {
                if (tree.children.length !== 2) {
                    throw 'functions must return a value'
                }

                return {
                    type: 'return',
                    expression: buildExpression(tree.children[1], context)
                }
            } else {
                if (tree.children.length !== 1) {
                    throw 'procedures can not return a value'
                }

                return {
                    type: 'return',
                }
            }

        case 'if': {
            const test = buildExpression(tree.children[1], context)
            const consequent = buildStatement(tree.children[2], context)

            if (tree.children.length === 3) {
                return {
                    type: 'if',
                    test,
                    consequent: consequent.type === 'do' ? consequent : { type: 'do', statements: [consequent] },
                }
            } else {
                const alternate = buildStatement(tree.children[3], context)

                return {
                    type: 'if',
                    test,
                    consequent: consequent.type === 'do' ? consequent : { type: 'do', statements: [consequent] },
                    alternate: alternate.type === 'do' ? alternate : { type: 'do', statements: [alternate] },
                }
            }
        }

        case 'while': {
            const test = buildExpression(tree.children[1], context)
            const body = []

            for (let i = 2; i < tree.children.length; i++) {
                body.push(buildStatement(tree.children[i], context))
            }

            return {
                type: 'while',
                test,
                body,
            }
        }

        case 'continue':
            return { type: 'continue' }

        case 'break':
            return { type: 'break' }

        case 'import':
        case 'export':
        case 'array':
        case 'fun':
        case 'proc':
            throw `${first.token.value} not allowed in functions or procedures`

        default:
            return buildCall(tree, context)
    }
}

function buildFun (tree, context) {
    if (tree.children.length < 3) {
        throw '(fun name [parameters...] statements...)'
    }

    expectIdentifier(tree.children[1], 'name must be an identifier')
    const name = tree.children[1].token.value

    expectList(tree.children[2], 'parameters must be a list')

    const params = []
    for (let i = 0; i < tree.children[2].children.length; i++) {
        const paramTree = tree.children[2].children[i]
        expectIdentifier(paramTree, 'parameters must be identifiers')
        params.push({ name: paramTree.token.value })
    }

    const fun = {
        name,
        params,
        vars: [],
        fun: true,
        namespaceToHash: context.namespaceToHash,
    }

    const statements = []

    for (let i = 3; i < tree.children.length; i++) {
        statements.push(buildStatement(tree.children[i], fun))
    }

    return { ...fun, statements }
}

function buildProc (tree, context) {
    if (tree.children.length < 3) {
        throw '(proc name (parameters...) statements...)'
    }

    expectIdentifier(tree.children[1], 'name must be an identifier')
    const name = tree.children[1].token.value

    expectList(tree.children[2], 'parameters must be a list')

    const params = []
    for (let i = 0; i < tree.children[2].children.length; i++) {
        const paramTree = tree.children[2].children[i]
        expectIdentifier(paramTree, 'parameters must be identifiers')
        params.push({ name: paramTree.token.value })
    }

    const proc = {
        name,
        params,
        vars: [],
        fun: false,
        namespaceToHash: context.namespaceToHash,
    }

    const statements = []

    for (let i = 3; i < tree.children.length; i++) {
        statements.push(buildStatement(tree.children[i], proc))
    }

    return { ...proc, statements }
}

function buildProgram (tree, resolvePath) {
    const context = Object.freeze({
        imports: [],
        exports: [],
        funs: [],
        procs: [],
        vars: [],
        arrays: [],
        importRefs: [],
        namespaceToHash: new Map,
    })

    const statements = []

    if (tree == null) {
        return {
            ...context,
            statements,
        }
    }

    expectForm(tree, 'expected module')

    if (tree.children[0].token.value !== 'module') {
        throw 'expected a module'
    }

    for (let i = 1; i < tree.children.length; i++) {
        const child = tree.children[i]

        expectForm(child, 'expected a (...)')

        const first = child.children[0]

        if (first.token.type === 'open') {
            statements.push(buildCall(child))
            continue
        }

        switch (first.token.value) {
            case 'import': {
                if (child.children.length !== 3) {
                    throw '(import local-namespace "file")'
                }

                expectIdentifier(child.children[1], 'local-namespace must be an identifier')
                const namespace = child.children[1].token.value

                if (context.namespaceToHash.has(namespace)) {
                    throw `local-namespace ${namespace} already used`
                }

                expectString(child.children[2], 'file must be a string')
                const file = child.children[2].token.value

                const hash = getHash(resolvePath(file))
                context.imports.push({ namespace, file, hash })
                context.namespaceToHash.set(namespace, hash)

                break
            }

            case 'export':
                for (let i = 1; i < child.children.length; i++) {
                    expectIdentifier(child.children[i], 'export entry must be an identifier')
                    context.exports.push(child.children[i].token.value)
                }

                break

            case 'var': {
                if (child.children.length < 2) {
                    throw 'variable must have a name'
                } else if (child.children.length > 3) {
                    throw '(var name value)'
                }

                expectIdentifier(child.children[1], 'variable name must be an identifier')

                const name = child.children[1].token.value
                context.vars.push({ name })

                if (child.children.length === 3) {
                    statements.push({
                        type: 'assignment',
                        left: { type: 'identifier', name },
                        right: buildExpression(child.children[2], context),
                    })
                }

                break
            }

            case 'array': {
                if (child.children.length !== 3) {
                    throw '(array name size)'
                }

                expectIdentifier(child.children[1], 'array name must be an identifier')
                const name = child.children[1].token.value

                expectNumber(child.children[2], 'array size must be a number')
                const size = child.children[2].token.value

                context.arrays.push({ name, size })

                break
            }

            case 'fun':
                context.funs.push(buildFun(child, context))

                break

            case 'proc':
                context.procs.push(buildProc(child, context))

                break

            default:
                statements.push(buildStatement(child, context))
        }
    }

    return {
        ...context,
        statements,
    }
}

function parseProgram (source, resolvePath) {
    const tokens = espace.Tokenizer.tokenize(source)
    const tree = espace.Parser.parse(tokens)
    return buildProgram(tree, resolvePath)
}


export { parseProgram }