function isAtomic (expression) {
    return expression.type === 'literal' ||
        expression.type === 'identifier'
}

function makeTempName (id) {
    return `_temp_${id}`
}

const makeTemper = (() => {
    const registers = ['r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15']

    return ({ includeRegisters }) => {
        let registerCount = 0
        let varCount = 0

        return {
            getTemp () {
                if (includeRegisters && registerCount < registers.length) {
                    const name = registers[registerCount]
                    registerCount++
                    return { type: 'register', name }
                } else {
                    const name = makeTempName(varCount)
                    varCount++
                    return { type: 'identifier', name }
                }
            },
            getCount () {
                return varCount
            },
        }
    }
})()

function lower (programHigh) {
    function containsCalls (expression) {
        switch (expression.type) {
            case 'call':
                return true

            case 'unary-op':
                return containsCalls(expression.operand)

            case 'binary-op':
                return containsCalls(expression.operand1) || containsCalls(expression.operand2)

            case 'subscript':
                return containsCalls(expression.base) || containsCalls(expression.offset)

            default:
                return false
        }
    }

    function traverseExpression (left, right, statements) {
        const temper = makeTemper({ includeRegisters: !containsCalls(right) })

        function traverse (left, right) {
            if (isAtomic(right) || right.type === 'call') {
                statements.push({ type: 'assignment', left, right })

                return
            }

            if (right.type === 'unary-op') {
                if (isAtomic(right.operand)) {
                    statements.push({ type: 'assignment', left, right })
                } else {
                    const tempOperand = temper.getTemp()

                    traverse(tempOperand, right.operand)

                    statements.push({
                        type: 'assignment',
                        left,
                        right: {
                            type: 'unary-op',
                            operator: right.operator,
                            operand: tempOperand,
                        },
                    })
                }

                return
            }

            if (right.type === 'binary-op') {
                if (isAtomic(right.operand1) && isAtomic(right.operand2)) {
                    statements.push({ type: 'assignment', left, right })

                    return
                }

                if (!isAtomic(right.operand1) && isAtomic(right.operand2)) {
                    const tempOperand1 = temper.getTemp()

                    traverse(tempOperand1, right.operand1)

                    statements.push({
                        type: 'assignment',
                        left,
                        right: {
                            type: 'binary-op',
                            operator: right.operator,
                            operand1: tempOperand1,
                            operand2: right.operand2,
                        },
                    })

                    return
                }

                if (isAtomic(right.operand1) && !isAtomic(right.operand2)) {
                    const tempOperand2 = temper.getTemp()

                    traverse(tempOperand2, right.operand2)

                    statements.push({
                        type: 'assignment',
                        left,
                        right: {
                            type: 'binary-op',
                            operator: right.operator,
                            operand1: right.operand1,
                            operand2: tempOperand2,
                        },
                    })

                    return
                }

                if (!isAtomic(right.operand1) && !isAtomic(right.operand2)) {
                    const tempOperand1 = temper.getTemp()
                    const tempOperand2 = temper.getTemp()

                    traverse(tempOperand1, right.operand1)
                    traverse(tempOperand2, right.operand2)

                    statements.push({
                        type: 'assignment',
                        left,
                        right: {
                            type: 'binary-op',
                            operator: right.operator,
                            operand1: tempOperand1,
                            operand2: tempOperand2,
                        },
                    })

                    return
                }
            }

            if (right.type === 'subscript') {
                if (right.base.type === 'identifier' && isAtomic(right)) {
                    statements.push({ type: 'assignment', left, right })

                    return
                }

                if (right.base.type !== 'identifier' && isAtomic(right)) {
                    const tempBase = temper.getTemp()

                    traverse(tempBase, right.base)

                    statements.push({
                        type: 'assignment',
                        left,
                        right: {
                            type: 'subscript',
                            base: tempBase,
                            offset: right.offset,
                        },
                    })

                    return
                }

                if (right.base.type === 'identifier' && !isAtomic(right)) {
                    const tempOffset = temper.getTemp()

                    traverse(tempOffset, right.offset)

                    statements.push({
                        type: 'assignment',
                        left,
                        right: {
                            type: 'subscript',
                            base: right.base,
                            offset: tempOffset,
                        },
                    })

                    return
                }

                if (right.base.type !== 'identifier' && !isAtomic(right)) {
                    const tempBase = temper.getTemp()
                    const tempOffset = temper.getTemp()

                    traverse(tempBase, right.base)
                    traverse(tempOffset, right.offset)

                    statements.push({
                        type: 'assignment',
                        left,
                        right: {
                            type: 'subscript',
                            base: tempBase,
                            offset: tempOffset,
                        },
                    })

                    return
                }
            }
        }

        traverse(left, right)

        return { tempCount: temper.getCount() }
    }

    function traverseStatements (statementsIn, context) {
        let tempCountRequested = 0

        function traverse (statementsIn) {
            const statementsOut = []

            for (const statementIn of statementsIn) {
                switch (statementIn.type) {
                    case 'assignment':
                        const result = traverseExpression(statementIn.left, statementIn.right, statementsOut)
                        tempCountRequested = Math.max(tempCountRequested, result.tempCount)

                        break

                    case 'do':
                        statementsOut.push({
                            type: 'do',
                            statements: traverse(statementIn.statements),
                        })

                        break

                    case 'if':
                        statementsOut.push(
                            statementIn.alternate == null ? {
                                type: 'if',
                                test: statementIn.test,
                                consequent: {
                                    type: 'do',
                                    statements: traverse(statementIn.consequent.statements),
                                },
                            } : {
                                type: 'if',
                                test: statementIn.test,
                                consequent: {
                                    type: 'do',
                                    statements: traverse(statementIn.consequent.statements),
                                },
                                alternate: {
                                    type: 'do',
                                    statements: traverse(statementIn.alternate.statements),
                                },
                            }
                        )

                        break

                    case 'while':
                        statementsOut.push({
                            type: 'while',
                            test: statementIn.test,
                            body: traverse(statementIn.body),
                        })

                        break

                    default:
                        statementsOut.push(statementIn)
                }
            }

            return statementsOut
        }

        const statementsOut = traverse(statementsIn)

        for (let i = 0; i < tempCountRequested; i++) {
            context.vars.push({ name: makeTempName(i) })
        }

        return statementsOut
    }

    const topContext = {
        vars: programHigh.vars.slice(),
    }

    const programLow = {
        imports: programHigh.imports,
        exports: programHigh.exports,
        vars: topContext.vars,
        arrays: programHigh.arrays,
        importRefs: programHigh.importRefs,
        namespaceToHash: programHigh.namespaceToHash,

        funs: programHigh.funs.map((fun) => {
            const localContext = {
                vars: fun.vars.slice(),
            }

            return {
                name: fun.name,
                params: fun.params,
                vars: localContext.vars,
                fun: true,
                namespaceToHash: fun.namespaceToHash,
                statements: traverseStatements(fun.statements, localContext),
            }
        }),

        procs: programHigh.procs.map((proc) => {
            const localContext = {
                vars: proc.vars.slice(),
            }

            return {
                name: proc.name,
                params: proc.params,
                vars: localContext.vars,
                fun: false,
                namespaceToHash: proc.namespaceToHash,
                statements: traverseStatements(proc.statements, localContext),
            }
        }),

        statements: traverseStatements(programHigh.statements, topContext),
    }

    return programLow
}


export { lower }