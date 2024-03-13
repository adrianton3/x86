import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'


const basePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function run (prefix) {
    const expectedFile = path.join(basePath, 'test', 'samples', `${prefix}.exp`)

    process.stdout.write(prefix)

    if (!fs.existsSync(expectedFile)) {
        process.stdout.write('skip'.padStart(30 - prefix.length, ' '))
        process.stdout.write('\n')

        return 'skip'
    }

    try {
        execFileSync('node', ['./local/compiler-cli.mjs', `./test/samples/${prefix}.source`], { cwd: basePath, stdio: 'pipe', encoding: 'utf-8' })
    } catch (ex) {
        process.stdout.write('fail'.padStart(30 - prefix.length, ' '))
        process.stdout.write('\n')
        process.stdout.write(ex.stderr)
        process.stdout.write('\n')

        return 'fail'
    }

    const executableFile = path.join(basePath, 'test', 'samples', `${prefix}.e`)

    const inFile = path.join(basePath, 'test', 'samples', `${prefix}.in`)
    const outFile = path.join(basePath, 'test', 'samples', `${prefix}.out`)

    const stdin = fs.existsSync(inFile) ? fs.openSync(inFile, 'r') : 'ignore'
    const stdouterr = fs.openSync(outFile, 'w')
    execFileSync(executableFile, [], { stdio: [stdin, stdouterr, stdouterr] })

    const expectedData = fs.readFileSync(expectedFile, { encoding: 'utf-8' })
    const outData = fs.readFileSync(outFile, { encoding: 'utf-8' })

    if (outData === expectedData) {
        process.stdout.write('ok'.padStart(30 - prefix.length, ' '))
        process.stdout.write('\n')

        return 'ok'
    } else {
        process.stdout.write('fail'.padStart(30 - prefix.length, ' '))
        process.stdout.write('\n')
        process.stdout.write(`expected ${expectedData}\n`)
        process.stdout.write(`but got  ${outData}\n`)
        process.stdout.write('\n\n')

        return 'fail'
    }
}

function runAll () {
    const files = fs.readdirSync(path.join(basePath, 'test', 'samples'))

    const results = {
        'ok': 0,
        'fail': 0,
        'skip': 0,
    }

    for (const file of files) {
        const { name, ext } = path.parse(file)

        if (ext === '.source') {
            const result = run(name)
            results[result]++
        }
    }

    process.stdout.write('\n')
    process.stdout.write(`Tests executed ${(results.ok + results.fail + results.skip).toString().padStart(4, ' ')}\n`)
    process.stdout.write(`Tests passed   ${results.ok.toString().padStart(4, ' ')}\n`)
    process.stdout.write(`Tests failed   ${results.fail.toString().padStart(4, ' ')}\n`)
    process.stdout.write(`Tests skipped  ${results.skip.toString().padStart(4, ' ')}\n`)

    if (results.fail === 0) {
        process.stdout.write('\nAll good\n')
    } else {
        process.stdout.write('\nSee error messages above\n')
    }
}


if (process.argv.length === 2) {
    runAll()
} else if (process.argv.length === 3) {
    run(process.argv[2])
} else {
    console.error('use: node runner.mjs [test-name]')
    process.exit(1)
}