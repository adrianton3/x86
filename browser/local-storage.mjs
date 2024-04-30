const namespace = 'com-source'

function hasSource () {
    return localStorage.getItem('com-source') != null
}

function loadSource () {
    return localStorage.getItem('com-source') ?? ''
}

function saveSource (source) {
    try {
        localStorage.setItem('com-source', source)
    } catch (ex) {
    }
}


export { hasSource, loadSource, saveSource }