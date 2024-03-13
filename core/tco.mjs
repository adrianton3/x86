function traverse (statements, context) {
    for (let index = 0; index < statements.length; index++) {
        const statement = statements[index]

        if (statement.type === 'return') {
            if (statement.expression != null && statement.expression.type === 'call') {
                statement.expression.tail = true
            }
        } else if (statement.type === 'call') {
            statement.tail = (index >= statements.length - 1 && context.isTailStatement) ||
                (index < statements.length - 1 && statements[index + 1].type === 'return')
        } else if (statement.type === 'do') {
            const isTailStatement = (index >= statements.length - 1 && context.isTailStatement) ||
                (index < statements.length - 1 && statements[index + 1].type === 'return')

            traverse(statement.statements, { isTailStatement })
        } else if (statement.type === 'if') {
            const isTailStatement = (index >= statements.length - 1 && context.isTailStatement) ||
                (index < statements.length - 1 && statements[index + 1].type === 'return')

            traverse([statement.consequent], { isTailStatement })

            if (statement.alternate != null) {
                traverse([statement.alternate], { isTailStatement })
            }
        }
    }
}

function traverseTco (program) {
    for (const fun of program.funs) {
        traverse(fun.statements, { isTailStatement: true })
    }

    for (const proc of program.procs) {
        traverse(proc.statements, { isTailStatement: true })
    }
}


export { traverseTco }