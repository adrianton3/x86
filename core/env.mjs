function raise (message) {
    throw { message }
}

function makeEnvTop (program) {
    const map = new Map

    map.set('writeChar', { type: 'proc', address: 'writeChar', params: ['char'], vars: [] })
    map.set('writeDigit', { type: 'proc', address: 'writeDigit', params: ['digit'], vars: [] })
    map.set('writeNumber', { type: 'proc', address: 'writeNumber', params: ['number'], vars: [] })
    map.set('readChar', { type: 'fun', address: 'readChar', params: [], vars: [] })
    map.set('readDigit', { type: 'fun', address: 'readDigit', params: [], vars: [] })
    map.set('alloc', { type: 'fun', address: 'alloc', params: ['size'], vars: [] })
    map.set('free', { type: 'fun', address: 'free', params: ['address'], vars: [] })

    for (const v of program.vars) {
        if (map.has(v.name)) {
            raise(`global symbol "${v.name}" aready declared`)
        }

        map.set(v.name, { type: 'top-var', address: v.name })
    }

    for (const a of program.arrays) {
        if (map.has(a.name)) {
            raise(`global symbol "${a.name}" aready declared`)
        }

        map.set(a.name, { type: 'top-array', address: a.name })
    }

    for (const fun of program.funs) {
        if (map.has(fun.name)) {
            raise(`global symbol "${fun.name}" aready declared`)
        }

        map.set(fun.name, { type: 'fun', address: fun.name, params: fun.params, vars: fun.vars })
    }

    for (const proc of program.procs) {
        if (map.has(proc.name)) {
            raise(`global symbol "${proc.name}" aready declared`)
        }

        map.set(proc.name, { type: 'proc', address: proc.name, params: proc.params, vars: proc.vars })
    }

    return { type: 'top', map }
}

function makeEnvLocal (envTop, params, locals) {
    const paramsMap = new Map
    const localsMap = new Map

    for (let i = 0; i < params.length; i++) {
        const param = params[i]

        paramsMap.set(param.name, { type: 'local-var', address: `rsp + ${(params.length - i + locals.length) * 8}` })
    }

    for (let i = 0; i < locals.length; i++) {
        const local = locals[i]

        // no arrays yet
        localsMap.set(local.name, { type: 'local-var', address: `rsp + ${(locals.length - i) * 8}` })
    }

    return { type: 'local', envTop, paramsMap, localsMap }
}

function resolve (name, env) {
    if (env.type === 'top') {
        if (env.map.has(name)) {
            return env.map.get(name)
        } else {
            raise(`undeclared global symbol "${name}"`)
        }
    } else {
        if (env.paramsMap.has(name)) {
            return env.paramsMap.get(name)
        } else if (env.localsMap.has(name)) {
            return env.localsMap.get(name)
        } else if (env.envTop.map.has(name)) {
            return env.envTop.map.get(name)
        } else {
            raise(`undeclared symbol "${name}"`)
        }
    }
}


export { makeEnvTop, makeEnvLocal, resolve }