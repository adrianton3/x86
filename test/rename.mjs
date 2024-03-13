import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'


const basePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function rename (oldPrefix, newPrefix, extension) {
    const oldFile = path.join(basePath, 'test', 'samples', `${oldPrefix}.${extension}`)
    const newFile = path.join(basePath, 'test', 'samples', `${newPrefix}.${extension}`)

    if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile)
    }
}


if (process.argv.length < 4) {
    console.log('use: node rename.mjs <old-prefix> <new-prefix>')
    process.exit(1)
}

const oldPrefix = process.argv[2]
const newPrefix = process.argv[3]

rename(oldPrefix, newPrefix, 'out')
rename(oldPrefix, newPrefix, 'exp')
rename(oldPrefix, newPrefix, 'source')
rename(oldPrefix, newPrefix, 'json')
rename(oldPrefix, newPrefix, 'nasm')
rename(oldPrefix, newPrefix, 'o')
rename(oldPrefix, newPrefix, 'e')