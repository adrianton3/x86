function setupEditor (elementId, options, handlers) {
    const editor = ace.edit(elementId)
    editor.setTheme('ace/theme/monokai')

    if (options?.modeJs) {
        editor.session.setMode('ace/mode/javascript')
    }

    if (handlers?.change != null) {
        editor.getSession().on('change', () => { handlers.change(editor.getValue()) })
    }

    editor.setOptions({ fontSize: '18pt' })

    if (options?.modeJs) {
        editor.session.$worker.send('changeOptions', [{ asi: true }])
    }

    if (options?.readOnly) {
        editor.setReadOnly(true)
    }

    return editor
}

function makeUi (handlers) {
    const sourceEditor = setupEditor('editor-source', {}, { change: handlers.changeSource })
    const astEditor = setupEditor('editor-ast', { modeJs: true, readOnly: true })
    const asmEditor = setupEditor('editor-asm', { readOnly: true })

    return {
        setSource (source) { sourceEditor.setValue(source, -1) },
        setAst (ast) { astEditor.setValue(ast, -1) },
        setAsm (asm) { asmEditor.setValue(asm, -1) },
    }
}


export { makeUi }