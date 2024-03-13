import * as path from 'path'
import * as fs from 'fs'
import { execFileSync } from 'child_process'

import { compile } from '../core/compiler.mjs'


function readFile (file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
}

function makeResolver (parent) {
    const dirname = path.dirname(parent)

    return (importFile) => path.isAbsolute(importFile)
        ? importFile
        : path.join(dirname, importFile)
}


if (process.argv.length !== 3) {
    console.error('use: node compiler-cli.mjs <source-file>')
    process.exit(1)
}

const initialFile = process.argv[2]
const initialParts = path.parse(initialFile)
const initialNoExtension = path.join(initialParts.dir, initialParts.name)

try {
    const programs = compile(
        path.isAbsolute(initialFile) ? initialFile : path.join(process.cwd(), initialFile),
        { readFile, makeResolver },
    )

    for (const { file, asm } of programs) {
        const fileParts = path.parse(file)
        const fileNoExtension = path.join(fileParts.dir, fileParts.name)

        const asmFile = `${fileNoExtension}.nasm`
        fs.writeFileSync(asmFile, asm)
    }

    const objectFiles = []
    for (const { file } of programs) {
        const fileParts = path.parse(file)
        const fileNoExtension = path.join(fileParts.dir, fileParts.name)

        const asmFile = `${fileNoExtension}.nasm`

        execFileSync('nasm', ['-felf64', asmFile], { stdio: 'pipe', encoding: 'utf-8' })

        objectFiles.push(`${fileNoExtension}.o`)
    }

    const executableFile = `${initialNoExtension}.e`

    execFileSync('ld', [...objectFiles, '-o', executableFile], { stdio: 'pipe', encoding: 'utf-8' })
} catch (ex) {
    console.error()
    console.error('error')
    console.error(
        ex.lineNumber != null ? `line ${ex.lineNumber}: ${ex.message}`
        : ex.message != null ? ex.message
        : ex.stderr != null ? ex.stderr
        : ex
    )

    process.exit(1)
}