/**
 * thompson.js
 * 
 * Thompson's Construction Algorithm
 * Converts a Regular Expression AST to an NFA (Nondeterministic Finite Automaton)
 * 
 * Each NFA fragment has:
 *   - start: the start state
 *   - accept: the single accept state
 *   - states: set of all state IDs
 *   - transitions: map of state → [{symbol, to}]
 * 
 * After construction, states are RENUMBERED so that:
 *   - Start state = q0
 *   - States are numbered in BFS order from start
 */

class ThompsonConstruction {
    constructor() {
        this.stateCounter = 0;
        this.steps = [];
    }

    /**
     * Create a new unique state
     */
    newState() {
        return this.stateCounter++;
    }

    /**
     * Convert an AST to an NFA
     * @param {object} ast - The AST from RegexParser
     * @returns {object} NFA = { start, accept, states, transitions, alphabet, steps }
     */
    astToNFA(ast) {
        this.stateCounter = 0;
        this.steps = [];
        
        const parser = new RegexParser();
        const alphabet = parser.getAlphabet(ast);

        const fragment = this.buildFragment(ast);

        // Collect all states
        const states = new Set();
        for (let i = 0; i < this.stateCounter; i++) {
            states.add(i);
        }

        // Build transition map
        const transitions = {};
        for (const state of states) {
            if (!transitions[state]) {
                transitions[state] = [];
            }
        }

        // Merge fragment transitions
        this._mergeTransitions(fragment, transitions);

        // RENUMBER states: BFS from start so start=q0
        const renumbered = this._renumberStates(
            fragment.start,
            fragment.accept,
            [...states],
            transitions,
            alphabet
        );

        return renumbered;
    }

    /**
     * Renumber states so start state = 0 and numbering follows BFS order
     */
    _renumberStates(start, accept, states, transitions, alphabet) {
        // BFS from start to get ordering
        const visited = [];
        const visitedSet = new Set();
        const queue = [start];
        visitedSet.add(start);

        while (queue.length > 0) {
            const s = queue.shift();
            visited.push(s);

            const trans = transitions[s] || [];
            for (const t of trans) {
                if (!visitedSet.has(t.to)) {
                    visitedSet.add(t.to);
                    queue.push(t.to);
                }
            }
        }

        // Add any states not reachable from start (shouldn't happen normally)
        for (const s of states) {
            if (!visitedSet.has(s)) {
                visited.push(s);
                visitedSet.add(s);
            }
        }

        // Build old→new mapping
        const oldToNew = {};
        for (let i = 0; i < visited.length; i++) {
            oldToNew[visited[i]] = i;
        }

        // Build new transitions
        const newTransitions = {};
        const newStates = [];
        for (let i = 0; i < visited.length; i++) {
            newStates.push(i);
            newTransitions[i] = [];
        }

        for (const oldState of visited) {
            const newState = oldToNew[oldState];
            const trans = transitions[oldState] || [];
            for (const t of trans) {
                newTransitions[newState].push({
                    symbol: t.symbol,
                    to: oldToNew[t.to]
                });
            }
        }

        const newStart = oldToNew[start]; // should be 0
        const newAccept = oldToNew[accept];

        // Rebuild steps with new numbering
        const renamedSteps = this.steps.map(step => {
            let desc = step.description;
            // Replace old q-numbers with new ones
            for (const oldS of visited) {
                const re = new RegExp(`q${oldS}\\b`, 'g');
                desc = desc.replace(re, `q${oldToNew[oldS]}`);
            }
            return { ...step, description: desc };
        });

        return {
            start: newStart,
            accept: newAccept,
            states: newStates,
            transitions: newTransitions,
            alphabet: alphabet,
            steps: renamedSteps
        };
    }

    /**
     * Recursively build an NFA fragment from an AST node
     */
    buildFragment(node) {
        switch (node.type) {
            case 'literal':
                return this.buildLiteral(node.value);
            case 'epsilon':
                return this.buildEpsilon();
            case 'concat':
                return this.buildConcat(node.left, node.right);
            case 'union':
                return this.buildUnion(node.left, node.right);
            case 'star':
                return this.buildStar(node.operand);
            default:
                throw new Error(`Unknown AST node type: ${node.type}`);
        }
    }

    /**
     * Build NFA for a single literal character: q0 --a--> q1
     */
    buildLiteral(symbol) {
        const start = this.newState();
        const accept = this.newState();

        const fragment = {
            start,
            accept,
            transitions: [{ from: start, symbol: symbol, to: accept }]
        };

        this.steps.push({
            type: 'literal',
            description: `Create NFA for literal '${symbol}': q${start} --${symbol}--> q${accept}`,
            fragment: { start, accept, symbol }
        });

        return fragment;
    }

    /**
     * Build NFA for epsilon: q0 --ε--> q1
     */
    buildEpsilon() {
        const start = this.newState();
        const accept = this.newState();

        const fragment = {
            start,
            accept,
            transitions: [{ from: start, symbol: 'ε', to: accept }]
        };

        this.steps.push({
            type: 'epsilon',
            description: `Create NFA for ε: q${start} --ε--> q${accept}`,
            fragment: { start, accept }
        });

        return fragment;
    }

    /**
     * Build NFA for concatenation: L1·L2
     * Connect accept of L1 to start of L2 via ε-transition
     */
    buildConcat(leftNode, rightNode) {
        const left = this.buildFragment(leftNode);
        const right = this.buildFragment(rightNode);

        // Merge: left.accept --ε--> right.start
        const fragment = {
            start: left.start,
            accept: right.accept,
            transitions: [
                ...left.transitions,
                { from: left.accept, symbol: 'ε', to: right.start },
                ...right.transitions
            ]
        };

        this.steps.push({
            type: 'concat',
            description: `Concatenation: connect q${left.accept} --ε--> q${right.start}. New NFA: q${left.start} to q${right.accept}`,
            fragment: { start: left.start, accept: right.accept, leftAccept: left.accept, rightStart: right.start }
        });

        return fragment;
    }

    /**
     * Build NFA for union: L1 | L2
     * New start --ε--> both starts
     * Both accepts --ε--> new accept
     */
    buildUnion(leftNode, rightNode) {
        const left = this.buildFragment(leftNode);
        const right = this.buildFragment(rightNode);

        const start = this.newState();
        const accept = this.newState();

        const fragment = {
            start,
            accept,
            transitions: [
                { from: start, symbol: 'ε', to: left.start },
                { from: start, symbol: 'ε', to: right.start },
                ...left.transitions,
                ...right.transitions,
                { from: left.accept, symbol: 'ε', to: accept },
                { from: right.accept, symbol: 'ε', to: accept }
            ]
        };

        this.steps.push({
            type: 'union',
            description: `Union: new start q${start} --ε--> q${left.start} and q${right.start}. Both accept states --> q${accept}`,
            fragment: { start, accept, leftStart: left.start, rightStart: right.start }
        });

        return fragment;
    }

    /**
     * Build NFA for Kleene star: L*
     * New start --ε--> L.start and new accept
     * L.accept --ε--> L.start (loop) and new accept
     */
    buildStar(operandNode) {
        const inner = this.buildFragment(operandNode);

        const start = this.newState();
        const accept = this.newState();

        const fragment = {
            start,
            accept,
            transitions: [
                { from: start, symbol: 'ε', to: inner.start },
                { from: start, symbol: 'ε', to: accept },
                ...inner.transitions,
                { from: inner.accept, symbol: 'ε', to: inner.start },
                { from: inner.accept, symbol: 'ε', to: accept }
            ]
        };

        this.steps.push({
            type: 'star',
            description: `Kleene Star: new start q${start}, loop q${inner.accept} --ε--> q${inner.start}, accept q${accept}`,
            fragment: { start, accept, innerStart: inner.start, innerAccept: inner.accept }
        });

        return fragment;
    }

    /**
     * Merge fragment transitions into the global transition map
     */
    _mergeTransitions(fragment, globalTransitions) {
        for (const t of fragment.transitions) {
            if (!globalTransitions[t.from]) {
                globalTransitions[t.from] = [];
            }
            globalTransitions[t.from].push({ symbol: t.symbol, to: t.to });
        }
    }
}
