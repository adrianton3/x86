import { makeEnvTop, makeEnvLocal, resolve } from './env.mjs'


function raise (message) {
    throw { message }
}

function validateProgram (program) {
    const envTop = makeEnvTop(program)

    function validateSinglet (singlet, env) {
        if (singlet.type === 'literal') {
            return
        }

        if (singlet.nameOriginal != null) {
            if (singlet.type === 'subscript') {
                raise('cannot index into an external function or procedure')
            }

            return
        }
    }

    function validateDestination (singlet, env) {
        if (singlet.type === 'literal') {
            raise('cannot assign to value')
        }

        if (singlet.type === 'identifier') {
            if (singlet.nameOriginal != null) {
                raise('cannot assign to an external function or procedure')
            }

            const source = resolve(singlet.name, env)

            if (source.type === 'top-array') {
                raise('cannot assign to a top level array')
            }

            if (source.type === 'fun' || source.type === 'proc') {
                raise('cannot assign to a function or procedure')
            }
        }

        if (singlet.type === 'subscript') {
            if (singlet.base.type === 'literal') {
                raise('cannot index into a value')
            }

            if (singlet.base.type === 'identifier') {
                if (singlet.base.nameOriginal != null) {
                    raise('cannot index into an external function or procedure')
                }

                const source = resolve(singlet.base.name, env)

                if (source.type === 'fun' || source.type === 'proc') {
                    raise('cannot assign to a function or procedure')
                }
            }

            if (singlet.offset.type === 'identifier') {
                const offset = resolve(singlet.offset.name, env)

                if (offset.type !== 'top-var' && offset.type !== 'local-var') {
                    raise('offset can only be a value or a variable')
                }
            }
        }
    }

    function validateCall (call, env) {
        const { calee, args } = call

        for (const arg of args) {
            validateSinglet(arg, env)
        }

        if (calee.type === 'literal') {
            raise('cannot call a value')
        }

        if (calee.nameOriginal != null) {
            return
        }

        if (calee.type === 'subscript') {
            validateSinglet(calee)
            return
        }

        const caleeResolved = resolve(calee.name, env)

        if (caleeResolved.type === 'top-array' && calee.type === 'identifier') {
            raise('cannot call an array')
        }

        if (caleeResolved.type === 'top-var' || caleeResolved.type === 'top-array' || caleeResolved.type === 'local-var') {
            if (calee.type === 'subscript' && calee.offset.type === 'identifier') {
                const indexResolved = resolve(calee.offset.name, env)

                if (indexResolved.type !== 'top-var' && indexResolved.type !== 'local-var') {
                    raise('index can only be a value or a variable')
                }
            }
        } else if (caleeResolved.type === 'fun' || caleeResolved.type === 'proc') {
            if (caleeResolved.params.length !== args.length) {
                raise(`expected ${caleeResolved.params.length} arguments but got ${args.length} instead`)
            }
        }
    }

    function validateRight (right, env) {
        if (right.type === 'identifier' || right.type === 'subscript') {
            validateSinglet(right, env)
        } else if (right.type === 'unary-op') {
            validateSinglet(right.operand, env)
        } else if (right.type === 'binary-op') {
            validateSinglet(right.operand1, env)
            validateSinglet(right.operand2, env)
        } else if (right.type === 'call') {
            validateCall(right, env)
        }
    }

    function validateStatement (statement, env) {
        if (statement.type === 'assignment') {
            validateRight(statement.right, env)
            validateDestination(statement.left, env)
        } else if (statement.type === 'inc' || statement.type === 'dec') {
            validateDestination(statement.singlet, env)
        } else if (statement.type === 'call') {
            validateCall(statement, env)
        } else if (statement.type === 'return') {
            if (statement.expression != null) {
                validateRight(statement.expression, env)
            }
        } else if (statement.type === 'if') {
            validateSinglet(statement.test.operand1, env)
            validateSinglet(statement.test.operand2, env)

            validateStatement(statement.consequent, env)

            if (statement.alternate != null) {
                validateStatement(statement.alternate, env)
            }
        } else if (statement.type === 'while') {
            validateSinglet(statement.test.operand1, env)
            validateSinglet(statement.test.operand2, env)

            validateBody(statement.body, env)
        }
    }

    function validateBody (body, env) {
        for (const statement of body) {
            validateStatement(statement, env)
        }
    }

    function validateReturns (statements) {
        function oneReturn (statement) {
            if (statement.type === 'return') {
                return true
            }

            if (statement.type === 'do') {
                return allReturn(statement.statements)
            }

            if (statement.type === 'if') {
                if (statement.alternate != null) {
                    return oneReturn(statement.consequent) && oneReturn(statement.alternate)
                }

                return false
            }
        }

        function allReturn (statements) {
            for (const statement of statements) {
                const result = oneReturn(statement)

                if (result) {
                    return true
                }
            }

            return false
        }

        if (!allReturn(statements)) {
            raise('all execution paths must return')
        }
    }

    for (const fun of program.funs) {
        const envLocal = makeEnvLocal(envTop, fun.params, fun.vars)

        validateBody(fun.statements, envLocal)
        validateReturns(fun.statements)
    }

    for (const proc of program.procs) {
        const envLocal = makeEnvLocal(envTop, proc.params, proc.vars)

        validateBody(proc.statements, envLocal)
    }

    validateBody(program.statements, envTop)
}


export { validateProgram }