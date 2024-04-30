import { parseProgram } from '../core/parser.mjs'
import { validateProgram } from '../core/validator.mjs'
import { traverseTco } from '../core/tco.mjs'
import { generateCode } from '../core/codegen.mjs'

import { hasSource, loadSource, saveSource } from './local-storage.mjs'
import { makeUi } from './ui.mjs'
import { sample } from './sample.mjs'


let ui

const handlers = {
    changeSource (source) {
        saveSource(source)

        try {
            const ast = parseProgram(source, null)
            validateProgram(ast)
            traverseTco(ast)
            ui.setAst(JSON.stringify(ast, null, 2))

            try {
                const asm = generateCode(ast, '')
                ui.setAsm(asm)
            } catch (ex) {
                ui.setAsm(ex.message)
            }
        } catch (ex) {
            ui.setAst(`/*\n\n${
                typeof ex === 'string' ? ex :
                ex.lineNumber != null ? `line ${ex.lineNumber}: ${ex.message}` :
                ex.message
            }\n\n*/`)

            ui.setAsm('')
        }
    }
}

ui = makeUi(handlers)
ui.setSource(hasSource() ? loadSource() : sample)