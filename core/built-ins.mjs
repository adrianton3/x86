const builtIns = {
    writeChar: {
        text: [
            `writeChar:`,
            `.post:`,
            `mov rax, 1`,
            `mov rdi, 1`,
            `lea rsi, [rsp + 8]`,
            `mov rdx, 1`,
            `syscall`,
            `ret 8`,
        ],
    },
    writeDigit: {
        text: [
            `writeDigit:`,
            `.post:`,
            `mov rax, 1`,
            `mov rdi, 1`,
            `add byte [rsp + 8], byte 48`,
            `lea rsi, [rsp + 8]`,
            `mov rdx, 1`,
            `syscall`,
            `ret 8`,
        ],
    },
    writeNumber: {
        bss: [
            `writeNumberBuffer resb 20`,
        ],
        text: [
            `writeNumber:`,
            `.post:`,
            `mov rax, [rsp + 8]`,
            `mov rsi, 10`,
            `mov rcx, 19    `,

            `.loop:`,
            `xor rdx, rdx`,
            `div rsi`,
            `add rdx, 48`,
            `mov [writeNumberBuffer + rcx], dl`,
            `dec rcx`,
            `cmp rax, 0`,
            `jg .loop`,

            `mov rax, 1`,
            `mov rdi, 1`,
            `inc rcx`,
            `lea rsi, [writeNumberBuffer + rcx]`,
            `mov rdx, 20`,
            `sub rdx, rcx`,
            `syscall`,
            `ret 8`,
        ],
    },
    readChar: {
        bss: [
            `readCharBuffer resq 1`,
        ],
        text: [
            `readChar:`,
            `.post:`,
            `mov rax, 0`,
            `mov rdi, 0`,
            `mov rsi, readCharBuffer`,
            `mov rdx, 1`,
            `syscall`,
            `movsx rax, byte [readCharBuffer]`,
            `ret`,
        ],
    },
    readDigit: {
        bss: [
            `readDigitBuffer resq 1`,
        ],
        text: [
            `readDigit:`,
            `.post:`,
            `mov rax, 0`,
            `mov rdi, 0`,
            `mov rsi, readDigitBuffer`,
            `mov rdx, 1`,
            `syscall`,
            `movsx rax, byte [readDigitBuffer]`,
            `sub rax, 48`,
            `ret`,
        ],
    },
    alloc: {
        text: [
            `alloc:`,
            `.post:`,
            `mov rax, 9`,
            `xor rdi, rdi`,         // addr 0
            `mov rsi, [rsp + 8]`,   // size
            `mov rdx, 3`,           // read|write 3
            `mov r10, 34`,          // anonymous|private 34
            `mov r8, -1`,           // fd -1
            `mov r9, 0`,            // offset 0
            `syscall`,
            `ret 8`,
        ],
    },
    free: {
        text: [
            `free:`,
            `.post:`,
            `mov rax, 11`,
            `mov rdi, [rsp + 8]`,   // addr
            `mov rsi, [rsp + 16]`,  // size
            `syscall`,
            `ret 16`,
        ],
    },
    exit: {
        text: [
            `exit:`,
            `.post:`,
            `mov rax, 60`,
            `mov rdi, [rsp + 8]`,
            `syscall`,
            // `ret 8`,
        ],
    },
}


export { builtIns }