function getHash (file) {
    return Array.from(file, (char) => char.charCodeAt(0))
        .reduce((prev, cur) => (prev + cur * 257) % 16777213, 0)
        .toString(36)
        .toUpperCase()
}


export { getHash }