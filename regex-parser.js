/**
 * regex-parser.js
 * 
 * Regular Expression Parser for Formal Language & Automata Theory
 * Parses a regex string into an Abstract Syntax Tree (AST)
 * 
 * Supported operators:
 *   | or + (union/alternation — both work as OR, standard in FLAT courses)
 *   * (Kleene star — zero or more)
 *   ? (zero or one)
 *   . (explicit concatenation — added during preprocessing)
 *   () grouping
 * 
 * Grammar (precedence low→high):
 *   Expr     → Term (('|'|'+') Term)*
 *   Term     → Factor Factor*
 *   Factor   → Atom ('*' | '?')*
 *   Atom     → CHAR | '(' Expr ')'
 */

class RegexParser {
    constructor() {
        this.pos = 0;
        this.input = '';
    }

    /**
     * Parse a regular expression string into an AST
     * @param {string} regex - The regular expression to parse
     * @returns {object} AST node
     */
    parse(regex) {
        if (!regex || regex.trim() === '') {
            throw new Error('Empty regular expression');
        }

        // Normalize: convert input to lowercase for case-insensitive matching
        const normalized = regex.toLowerCase();

        // Preprocess: add explicit concatenation operators
        this.input = this.addConcatOperator(normalized);
        this.pos = 0;

        const ast = this.parseExpr();

        if (this.pos < this.input.length) {
            throw new Error(`Unexpected character '${this.input[this.pos]}' at position ${this.pos}`);
        }

        return ast;
    }

    /**
     * Insert explicit concatenation '.' operators where needed
     * e.g. "ab" → "a.b", "(a)(b)" → "(a).(b)", "a*b" → "a*.b"
     * 
     * Note: '+' is treated as union (same as '|'), not as a postfix operator.
     */
    addConcatOperator(regex) {
        let result = '';
        const infixOps = new Set(['|', '+']); // union operators
        const postfixChars = new Set(['*', '?', ')']);

        for (let i = 0; i < regex.length; i++) {
            const c = regex[i];
            result += c;

            if (i + 1 < regex.length) {
                const next = regex[i + 1];

                // Add '.' (concat) after: literal, ), *, ?
                // Before: literal, (
                // But NOT if next is an infix operator (+, |) or postfix (* ?)
                // And NOT if current is an infix operator or (
                const currentCanEnd = this.isLiteral(c) || postfixChars.has(c);
                const nextCanStart = this.isLiteral(next) || next === '(';

                if (currentCanEnd && nextCanStart) {
                    result += '.';
                }
            }
        }
        return result;
    }

    /**
     * Check if character is a literal (not an operator)
     */
    isLiteral(c) {
        return c !== '|' && c !== '+' && c !== '*' && c !== '?' && 
               c !== '(' && c !== ')' && c !== '.';
    }

    /**
     * Parse union: Expr → Term (('|'|'+') Term)*
     * Both '|' and '+' are treated as union (OR) operators
     */
    parseExpr() {
        let left = this.parseTerm();

        while (this.pos < this.input.length && 
               (this.input[this.pos] === '|' || this.input[this.pos] === '+')) {
            this.pos++; // consume '|' or '+'
            const right = this.parseTerm();
            left = { type: 'union', left, right };
        }

        return left;
    }

    /**
     * Parse concatenation: Term → Factor Factor*
     */
    parseTerm() {
        let left = this.parseFactor();

        while (this.pos < this.input.length && this.input[this.pos] === '.') {
            this.pos++; // consume '.'
            const right = this.parseFactor();
            left = { type: 'concat', left, right };
        }

        return left;
    }

    /**
     * Parse postfix operators: Factor → Atom ('*' | '?')*
     * Note: '+' is NOT a postfix operator here, it's union (handled in parseExpr)
     */
    parseFactor() {
        let node = this.parseAtom();

        while (this.pos < this.input.length) {
            const c = this.input[this.pos];
            if (c === '*') {
                this.pos++;
                node = { type: 'star', operand: node };
            } else if (c === '?') {
                this.pos++;
                // a? = (a|ε) (zero or one)
                node = { type: 'union', left: node, right: { type: 'epsilon' } };
            } else {
                break;
            }
        }

        return node;
    }

    /**
     * Parse atom: Atom → CHAR | '(' Expr ')'
     */
    parseAtom() {
        if (this.pos >= this.input.length) {
            throw new Error('Unexpected end of expression');
        }

        const c = this.input[this.pos];

        if (c === '(') {
            this.pos++; // consume '('
            const node = this.parseExpr();
            if (this.pos >= this.input.length || this.input[this.pos] !== ')') {
                throw new Error('Missing closing parenthesis');
            }
            this.pos++; // consume ')'
            return node;
        }

        if (c === ')') {
            throw new Error('Unexpected closing parenthesis');
        }

        if (c === '|' || c === '+' || c === '*' || c === '?') {
            throw new Error(`Unexpected operator '${c}' at position ${this.pos}`);
        }

        // It's a literal character
        this.pos++;
        return { type: 'literal', value: c };
    }

    /**
     * Get the alphabet (set of unique literal characters) from the AST
     */
    getAlphabet(ast) {
        const alphabet = new Set();
        this._collectAlphabet(ast, alphabet);
        return [...alphabet].sort();
    }

    _collectAlphabet(node, alphabet) {
        if (!node) return;
        if (node.type === 'literal') {
            alphabet.add(node.value);
        } else if (node.type === 'union' || node.type === 'concat') {
            this._collectAlphabet(node.left, alphabet);
            this._collectAlphabet(node.right, alphabet);
        } else if (node.type === 'star') {
            this._collectAlphabet(node.operand, alphabet);
        }
    }

    /**
     * Convert AST back to a readable regex string
     */
    astToString(node) {
        if (!node) return '';
        switch (node.type) {
            case 'literal':
                return node.value;
            case 'epsilon':
                return 'ε';
            case 'union':
                return `(${this.astToString(node.left)}|${this.astToString(node.right)})`;
            case 'concat':
                return this.astToString(node.left) + this.astToString(node.right);
            case 'star':
                const operandStr = this.astToString(node.operand);
                if (node.operand.type === 'literal' || node.operand.type === 'epsilon') {
                    return operandStr + '*';
                }
                return `(${operandStr})*`;
            default:
                return '';
        }
    }
}
