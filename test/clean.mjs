import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'


const basePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const files = fs.readdirSync(path.join(basePath, 'test', 'samples'))

for (const file of files) {
    const { ext } = path.parse(file)

    if (!['.source', '.in', '.exp'].includes(ext)) {
        fs.unlinkSync(path.join(basePath, 'test', 'samples', file))
    }
}