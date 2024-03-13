import { makeEnvTop, makeEnvLocal, resolve } from './env.mjs'
import { builtIns } from './built-ins.mjs'
import { lower } from './lower.mjs'


const jumpTypes = new Map([
    ['<', 'jae'],
    ['<=', 'ja'],
    ['>=', 'jb'],
    ['>', 'jbe'],
    ['==', 'jne'],
    ['!=', 'je'],
])

function makeIdGenerator () {
    let idIndex = 0

    return () => {
        idIndex++
        return String(idIndex)
    }
}

function makeJoiner () {
    const lines = []

    function isTop (line) {
        return line.startsWith('global') ||
            line.startsWith('extern') ||
            line.startsWith('section') ||
            line.endsWith(':')
    }

    return {
        push (...args) {
            lines.push(...args.map((line) => isTop(line) ? line : `    ${line}`))
        },
        join () { return lines.join('\n') },
    }
}

function generateCode (programHigh, hashOwn) {
    const { push, join } = makeJoiner()
    const getId = makeIdGenerator()

    const program = lower(programHigh)

    const envTop = makeEnvTop(program)

    // ---
    function compileOffset (start, resolved, env) {
        if (start.offset.type === 'literal') {
            push(`mov rsi, [${resolved.address}]`)
            return `qword [rsi + ${start.offset.value * 8}]` // remove qword
        } else if (start.offset.type === 'register') {
            push(`mov rsi, [${resolved.address}]`)
            return `qword [rsi + ${start.offset.name} * 8]`
        } else if (start.offset.type === 'identifier') {
            const index = resolve(start.offset.name, env)

            if (index.type === 'top-var' || index.type === 'local-var') {
                push(`mov rsi, [${resolved.address}]`)
                push(`mov rdi, [${index.address}]`)
                return `qword [rsi + rdi * 8]` // remove qword
            }
        }
    }

    function compileSinglet (singlet, env) {
        if (singlet.type === 'literal') {
            return `${singlet.value}`
        }

        if (singlet.type === 'register') {
            return singlet.name
        }

        if (singlet.type === 'identifier' && singlet.nameOriginal != null) {
            return singlet.name
        }

        if (singlet.type === 'identifier') {
            const source = resolve(singlet.name, env)

            if (source.type === 'top-var') {
                return `qword [${singlet.name}]` // remove qword
            } else if (source.type === 'top-array') {
                return source.address
            } else if (source.type === 'local-var') {
                return `qword [${source.address}]` // remove qword
            } else if (source.type === 'fun' || source.type === 'proc') {
                return source.address
            }
        } else if (singlet.type === 'subscript') {
            if (singlet.base.type === 'register') {
                if (singlet.offset.type === 'literal') {
                    return `qword [${singlet.base.name} + ${singlet.offset.value * 8}]`
                } else if (singlet.offset.type === 'register') {
                    return `qword [${singlet.base.name} + ${singlet.offset.name} * 8]`
                } else if (singlet.offset.type === 'identifier') {
                    const index = resolve(singlet.offset.name, env)

                    if (index.type === 'top-var' || index.type === 'local-var') {
                        push(`mov rdi, [${index.address}]`)
                        return `qword [${singlet.base.name} + rdi * 8]`
                    }
                }
            } else {
                const source = resolve(singlet.base.name, env)

                if (source.type === 'top-var') {
                    return compileOffset(singlet, source, env)
                } else if (source.type === 'top-array') {
                    if (singlet.offset.type === 'literal') {
                        return `qword [${source.address} + ${singlet.offset.value * 8}]` // remove qword
                    } else if (singlet.offset.type === 'register') {
                        return `qword [${source.address} + ${singlet.offset.name} * 8]`
                    } else if (singlet.offset.type === 'identifier') {
                        const index = resolve(singlet.offset.name, env)

                        if (index.type === 'top-var' || index.type === 'local-var') {
                            push(`mov rdi, [${index.address}]`)
                            return `qword [${source.address} + rdi * 8]` // remove qword
                        }
                    }
                } else if (source.type === 'local-var') {
                    return compileOffset(singlet, source, env)
                }
            }
        }
    }

    function compileDestination (left, env) {
        if (left.type === 'register') {
            return left.name
        } else if (left.type === 'identifier') {
            const destination = resolve(left.name, env)

            if (destination.type === 'top-var') {
                return `qword [${left.name}]` // remove qword
            } else if (destination.type === 'local-var') {
                return `[${destination.address}]`
            }
        } else if (left.type === 'subscript') {
            const destination = resolve(left.base.name, env)

            if (destination.type === 'top-var') {
                return compileOffset(left, destination, env)
            } else if (destination.type === 'top-array') {
                if (left.offset.type === 'literal') {
                    return `[${destination.address} + ${left.offset.value * 8}]`
                } else if (left.offset.type === 'identifier') {
                    const index = resolve(left.offset.name, env)

                    if (index.type === 'top-var' || index.type === 'local-var') {
                        push(`mov rdi, qword [${index.address}]`)
                        return `[${destination.address} + rdi * 8]`
                    }
                }
            } else if (destination.type === 'local-var') {
                return compileOffset(left, destination, env)
            }
        }
    }

    function compileUnaryOperation (expression, env) {
        if (expression.operator === 'bitNot') {
            const operandString = compileSinglet(expression.operand, env)
            push(`mov rax, ${operandString}`)
            push(`not rax`)
        } else if (expression.operator === 'not') {
            const operandString = compileSinglet(expression.operand, env)
            push(`mov rax, ${operandString}`)
            push(`test rax, rax`)
            push(`sete al`)
            push(`movzx rax, al`)
        }

        return 'rax'
    }

    const mulTemplates = new Map([
        [0, ['xor rax, rax']],
        [1, []],
        [2, ['add rax, rax']],
        [3, ['lea rax, [rax + rax * 2]']],
        [4, ['shl rax, 2']],
        [5, ['lea rax, [rax + rax * 4]']],
        [6, ['add rax, rax', 'lea rax, [rax + rax * 2]']],
        [8, ['shl rax, 3']],
        [9, ['lea rax, [rax + rax * 8]']],
        [10, ['add rax, rax', 'lea rax, [rax + rax * 4]']],
        [12, ['shl rax, 2', 'lea rax, [rax + rax * 2]']],
        [15, ['lea rax, [rax + rax * 2]', 'lea rax, [rax + rax * 4]']],
        [16, ['shl rax, 4']],
        [18, ['add rax, rax', 'lea rax, [rax + rax * 8]']],
        [20, ['shl rax, 2', 'lea rax, [rax + rax * 4]']],
        [24, ['shl rax, 3', 'lea rax, [rax + rax * 2]']],
        [25, ['lea rax, [rax + rax * 4]', 'lea rax, [rax + rax * 4]']],
        [27, ['lea rax, [rax + rax * 2]', 'lea rax, [rax + rax * 8]']],
        [32, ['shl rax, 5']],
        [36, ['shl rax, 2', 'lea rax, [rax + rax * 8]']],
        [40, ['shl rax, 3', 'lea rax, [rax + rax * 4]']],
        [45, ['lea rax, [rax + rax * 4]', 'lea rax, [rax + rax * 8]']],
        [48, ['shl rax, 4', 'lea rax, [rax + rax * 2]']],
        [64, ['shl rax, 6']],
        [72, ['shl rax, 3', 'lea rax, [rax + rax * 8]']],
        [80, ['shl rax, 4', 'lea rax, [rax + rax * 4]']],
        [81, ['lea rax, [rax + rax * 8]', 'lea rax, [rax + rax * 8]']],
        [128, ['shl rax, 7']],
        [144, ['shl rax, 4', 'lea rax, [rax + rax * 8]']],
        [256, ['shl rax, 8']],
        [512, ['shl rax, 9']],
        [1024, ['shl rax, 10']],
    ])

    function compileMul (expression, env) {
        if (expression.operand1.type === 'literal' || expression.operand2.type === 'literal') {
            const [operandLiteral, operandNonliteral] = expression.operand1.type === 'literal'
                ? [expression.operand1, expression.operand2]
                : [expression.operand2, expression.operand1]

            const operandNonliteralString = compileSinglet(operandNonliteral, env)

            if (mulTemplates.has(operandLiteral.value)) {
                push(`mov rax, ${operandNonliteralString}`)
                push(...mulTemplates.get(operandLiteral.value))
            } else {
                push(`imul rax, ${operandNonliteralString}, ${operandLiteral.value}`)
            }
        } else {
            const operand1String = compileSinglet(expression.operand1, env)
            push(`mov rax, ${operand1String}`)
            const operand2String = compileSinglet(expression.operand2, env)
            push(`imul rax, ${operand2String}`)
        }

        return 'rax'
    }

    function isPot (value) {
        return (value & (value - 1)) === 0 && value !== 0
    }

    function compileDiv (expression, env) {
        const operand1String = compileSinglet(expression.operand1, env)
        push(`mov rax, ${operand1String}`)

        if (expression.operand2.type === 'literal') {
            if (isPot(expression.operand2.value)) {
                push(`shr rax, ${Math.log2(expression.operand2.value)}`)
            } else {
                push(`mov rcx, ${expression.operand2.value}`)
                push(`xor rdx, rdx`)
                push(`div rcx`)
            }
        } else {
            const operand2String = compileSinglet(expression.operand2, env)
            push(`xor rdx, rdx`)
            push(`div ${operand2String}`)
        }

        return 'rax'
    }

    function compileMod (expression, env) {
        const operand1String = compileSinglet(expression.operand1, env)
        push(`mov rax, ${operand1String}`)

        if (expression.operand2.type === 'literal') {
            if (isPot(expression.operand2.value)) {
                push(`and rax, ${(expression.operand2.value - 1).toString(2)}b`)
                return 'rax'
            } else {
                push(`mov rcx, ${expression.operand2.value}`)
                push(`xor rdx, rdx`)
                push(`div rcx`)
            }
        } else {
            const operand2String = compileSinglet(expression.operand2, env)
            push(`xor rdx, rdx`)
            push(`div ${operand2String}`)
        }

        return 'rdx'
    }

    const binaryOperations = new Map([
        ['+', 'add'],
        ['-', 'sub'],
        ['bitAnd', 'and'],
        ['bitOr', 'or'],
        ['bitXor', 'xor'],
    ])

    function compileBinaryOperation (expression, env) {
        if (binaryOperations.has(expression.operator)) {
            const operand1String = compileSinglet(expression.operand1, env)
            push(`mov rax, ${operand1String}`)

            const operand2String = compileSinglet(expression.operand2, env)
            push(`${binaryOperations.get(expression.operator)} rax, ${operand2String}`)

            return 'rax'
        } else if (expression.operator === '*') {
            return compileMul(expression, env)
        } else if (expression.operator === '/') {
            return compileDiv(expression, env)
        } else if (expression.operator === '%') {
            return compileMod(expression, env)
        }
    }

    function compileRight (right, env) {
        if (right.type === 'literal') {
            return `qword ${right.value}`
        // } else if (right.type === 'register' ...
        } else if (right.type === 'identifier' || right.type === 'subscript') {
            const sourceString = compileSinglet(right, env)
            push(`mov rax, ${sourceString}`)
            return `rax`
        } else if (right.type === 'unary-op') {
            return compileUnaryOperation(right, env)
        } else if (right.type === 'binary-op') {
            return compileBinaryOperation(right, env)
        } else if (right.type === 'call') { // fun call
            for (const arg of right.args) {
                const singletString = compileSinglet(arg, env)
                push(`push ${singletString}`)
            }

            const caleeString = compileSinglet(right.calee, env)
            push(`call ${caleeString}`)
            return `rax`
        }
    }

    function compileTest (test, env) {
        if (test.operand1.type !== 'literal' && test.operand2.type === 'literal') {
            const operand1String = compileSinglet(test.operand1, env)
            push(`cmp ${operand1String}, ${test.operand2.value}`)
        } else {
            const operand1String = compileSinglet(test.operand1, env)
            const operand2String = compileSinglet(test.operand2, env)
            push(`mov rax, ${operand1String}`)
            push(`cmp rax, ${operand2String}`)
        }
    }

    function compileStatement (statement, env, localContext, whileLabels) {
        if (statement.type === 'do') {
            compileBody(statement.statements, env, localContext, whileLabels)
        } else if (statement.type === 'assignment') {
            const sourceString = compileRight(statement.right, env)
            const destinationString = compileDestination(statement.left, env)
            push(`mov qword ${destinationString}, qword ${sourceString}`)
        } else if (statement.type === 'inc') {
            const destinationString = compileDestination(statement.singlet, env)
            push(`inc qword ${destinationString}`)
        } else if (statement.type === 'dec') {
            const destinationString = compileDestination(statement.singlet, env)
            push(`dec qword ${destinationString}`)
        } else if (statement.type === 'call') {
            // try tco
            if (statement.calee.type === 'identifier' && statement.tail) {
                const calee = resolve(statement.calee.name, env)

                if (calee.type === 'fun' || calee.type === 'proc') {
                    const localsDelta = (calee.params.length + calee.vars.length) -
                        (localContext.params.length + localContext.vars.length)

                    if (localsDelta !== 0) {
                        push(`mov rbx, [rsp]`)
                    }

                    for (let argIndex = 0; argIndex < statement.args.length; argIndex++) {
                        const arg = statement.args[argIndex]

                        const singletString = compileSinglet(arg, env)
                        push(`mov rax, ${singletString}`)
                        push(`mov [rsp + ${(localContext.params.length - argIndex + localContext.vars.length) * 8}], rax`)
                    }

                    if (localsDelta !== 0) {
                        push(
                            localsDelta < 0 ? `add rsp, ${-localsDelta * 8}` : `sub rsp, ${localsDelta * 8}`,
                            `mov [rsp], rbx`,
                        )
                    }

                    push(`jmp ${statement.calee.name}.post`)

                    return
                }
            }

            // else
            for (const arg of statement.args) {
                const singletString = compileSinglet(arg, env)
                push(`push ${singletString}`)
            }

            const caleeString = compileSinglet(statement.calee, env)
            push(`call ${caleeString}`)
        } else if (statement.type === 'return') {
            // try tco
            if (
                statement.expression != null && statement.expression.type === 'call' &&
                statement.expression.calee.type === 'identifier' && statement.expression.tail
            ) {
                const calee = resolve(statement.expression.calee.name, env)

                if (calee.type === 'fun') {
                    const localsDelta = (calee.params.length + calee.vars.length) -
                        (localContext.params.length + localContext.vars.length)

                    if (localsDelta !== 0) {
                        push(`mov rbx, [rsp]`)
                    }

                    for (let argIndex = 0; argIndex < statement.expression.args.length; argIndex++) {
                        const arg = statement.expression.args[argIndex]

                        const singletString = compileSinglet(arg, env)
                        push(`mov rax, ${singletString}`)
                        push(`mov [rsp + ${(localContext.params.length - argIndex + localContext.vars.length) * 8}], rax`)
                    }

                    if (localsDelta !== 0) {
                        push(
                            localsDelta < 0 ? `add rsp, ${-localsDelta * 8}` : `sub rsp, ${localsDelta * 8}`,
                            `mov [rsp], rbx`,
                        )
                    }

                    push(`jmp ${statement.expression.calee.name}.post`)

                    return
                }
            }

            // else
            if (statement.expression != null) {
                const sourceString = compileRight(statement.expression, env)

                if (sourceString !== 'rax') {
                    push(`mov rax, ${sourceString}`)
                }
            }

            push(`ret ${(localContext.params.length + localContext.vars.length) * 8}`)
        } else if (statement.type === 'if') {
            const id = getId()

            compileTest(statement.test, env)

            const jumpType = jumpTypes.get(statement.test.operator)

            if (statement.alternate == null) {
                push(`${jumpType} if_${id}_end`)

                compileStatement(statement.consequent, env, localContext, whileLabels)

                push(`if_${id}_end:`)
            } else {
                push(`${jumpType} if_${id}_else`)

                compileStatement(statement.consequent, env, localContext, whileLabels)

                push(`jmp if_${id}_end`)
                push(`if_${id}_else:`)

                compileStatement(statement.alternate, env, localContext, whileLabels)

                push(`if_${id}_end:`)
            }
        } else if (statement.type === 'while') {
            const id = getId()

            push(`while_${id}:`)

            compileTest(statement.test, env)

            const jumpType = jumpTypes.get(statement.test.operator)
            push(`${jumpType} while_${id}_end`)

            compileBody(statement.body, env, localContext, { start: `while_${id}`, end: `while_${id}_end` })

            push(`jmp while_${id}`)
            push(`while_${id}_end:`)
        } else if (statement.type === 'break') {
            push(`jmp ${whileLabels.end}`)
        } else if (statement.type === 'continue') {
            push(`jmp ${whileLabels.start}`)
        }
    }

    function compileBody (statements, env, localContext, whileLabels) {
        for (const statement of statements) {
            compileStatement(statement, env, localContext, whileLabels)
        }
    }

    // ---
    push(`section .bss`)

    if (program.statements.length > 0) {
        for (const builtIn of Object.values(builtIns)) {
            if (builtIn.bss != null) {
                push(...builtIn.bss)
            }
        }
    }

    for (const v of program.vars) {
        push(`${v.name} resq 1`)
    }

    for (const a of program.arrays) {
        push(`${a.name} resq ${a.size}`)
    }

    // ---
    if (program.statements.length > 0) {
        push(`global _start`)
    }

    for (const impRef of program.importRefs) {
        push(
            `extern ${impRef}`,
            `extern ${impRef}.post`,
        )
    }

    for (const exp of program.exports) {
        push(
            `extern ${hashOwn}_${exp}`,
            `extern ${hashOwn}_${exp}.post`,
        )
    }

    for (const builtIn of Object.keys(builtIns)) {
        push(
            `extern ${builtIn}`,
            `extern ${builtIn}.post`,
        )
    }

    push(`section .text`)

    if (program.statements.length > 0) {
        push(`_start:`)

        compileBody(program.statements, envTop, null, null)

        push(
            ``,
            `; exit`,
            `mov rax, 60`,
            `xor rdi, rdi`,
            `syscall`,
        )
    }

    // ---
    const exportSet = new Set(program.exports)

    for (const fun of program.funs) {
        const envLocal = makeEnvLocal(envTop, fun.params, fun.vars)

        if (exportSet.has(fun.name)) {
            push(`${hashOwn}_${fun.name}:`)
        }

        push(`${fun.name}:`)

        if (fun.vars.length > 0) {
            push(
                `mov rax, [rsp]`,
                `sub rsp, ${fun.vars.length * 8}`,
                `mov [rsp], rax`,
            )
        }

        push(`.post:`)

        compileBody(fun.statements, envLocal, { name: fun.name, params: fun.params, vars: fun.vars }, null)
    }

    for (const proc of program.procs) {
        const envLocal = makeEnvLocal(envTop, proc.params, proc.vars)

        if (exportSet.has(proc.name)) {
            push(`${hashOwn}_${proc.name}:`)
        }

        push(`${proc.name}:`)

        if (proc.vars.length > 0) {
            push(
                `mov rax, [rsp]`,
                `sub rsp, ${proc.vars.length * 8}`,
                `mov [rsp], rax`,
            )
        }

        push(`.post:`)

        compileBody(proc.statements, envLocal, { name: proc.name, params: proc.params, vars: proc.vars }, null)

        if (
            proc.statements.length <= 0 ||
            proc.statements[proc.statements.length - 1].type !== 'return'
        ) {
            push(`ret ${(proc.params.length + proc.vars.length) * 8}`)
        }
    }

    // ---
    if (program.statements.length > 0) {
        for (const builtIn of Object.values(builtIns)) {
            if (builtIn.text != null) {
                push(...builtIn.text)
            }
        }
    }

    return join()
}


export { generateCode }