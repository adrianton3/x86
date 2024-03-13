import { getHash } from '../core/hash.mjs'
import { parseProgram } from '../core/parser.mjs'
import { validateProgram } from '../core/validator.mjs'
import { traverseTco } from '../core/tco.mjs'
import { generateCode } from '../core/codegen.mjs'


function compile (file, { readFile, makeResolver }) {
    const programs = []

    function traverse (file) {
        const source = readFile(file)
        const hash = getHash(file)

        const resolveImportFile = makeResolver(file)
        const ast = parseProgram(source, resolveImportFile)

        validateProgram(ast)

        traverseTco(ast)

        for (const imp of ast.imports) {
            traverse(resolveImportFile(imp.file))
        }

        const asm = generateCode(ast, hash)

        programs.push({ file, asm })
    }

    traverse(file)

    return programs
}


export { compile }