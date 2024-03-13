function loadSource () {
    return localStorage.getItem('com-source') ?? ''
}

function saveSource (source) {
    try {
        localStorage.setItem('com-source', source)
    } catch (ex) {
    }
}


export { loadSource, saveSource }