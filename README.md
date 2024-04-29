x86
===

This is an educational/for-fun project - a toy compiler for a language with lispy syntax that outputs x86-64 (nasm) assembly.

There is only one data type: 64-bit unsigned integer (that are also be used as memory addresses).
Basic optimizations for `*`, `/` and `%` are performed; tail calls (recursive and sibling) are optimized away as well.


#### Sample

```
;; sub.source -----------------------------------------------------------------

(module sub
    (fun min (a b)
        (if (< a b)
            (return a)
            (return b)
        )
    )

    (fun max (a b)
        (if (> a b)
            (return a)
            (return b)
        )
    )

    (export
        min
        max
    )
)



;; main.source ----------------------------------------------------------------

(module m
    (import s "./sub.source")

    (var v1)
    (set v1 (s::min 11 22))

    (writeNumber v1)

    (writeChar 32) ; space

    (var v2 (s::max 11 22))
    (writeNumber v2)
)
```

There are more samples in `test/samples`


#### Built-ins

+ `(var a)` declares a in a module scope or in a function scope
+ `(var a value)` declares a and initializes it
+ `(set a 123)` sets a value
+ `(array a size)` declares an array of a specified size at module scope (only)

+ `(at a offset)` retrieve the value at address a + offset
+ `(set (at a 1) 123)` sets a value in an array

+ `(+ a b)` returns a + b
+ `(- a b)` returns a - b
+ `(* a b)` returns a * b
+ `(/ a b)` returns a / b (integer division)
+ `(% a b)` returns a % b

+ `(bitAnd a b)` returns bitwise a and b
+ `(bitOr a b)` returns bitwise a or b
+ `(bitXor a b)` returns bitwise a exclusive-or b

+ `(not a)` returns not a
+ `(bitNot a)` returns bitwise not a

+ `(inc a)` increment a
+ `(dec a)` decrement a

+ `(if (< a b) consequent)`
+ `(if (<= a b) consequent alternate)`

+ `(if (== a b) (do stmt1 stmt2))` execute more statements

+ `(while (>= a b) body)`

+ `(fun f (p1 p2 p3) body)` declare a function
+ `(f 1 2 3)` call a function
+ `(return a)`
+ `(proc p (p1 p2 p3) body)` declare a procedure (acts as a function that does not return a value)

+ `(writeChar code)` writes a char to stdout
+ `(writeDigit digit)` writes a digit to stdout
+ `(writeNumber number)` writes a number to stdout
+ `(readChar)` reads one char and returns its code from stdin
+ `(readDigit)` reads one digit and returns its value from stdin

+ `(alloc size)` allocates memory (via mmap)
+ `(free pointer)` frees memory

+ `(exit code)` - exits with the supplied code