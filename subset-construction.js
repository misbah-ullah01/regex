/**
 * subset-construction.js
 * 
 * Subset Construction Algorithm (NFA to DFA conversion)
 * 
 * Converts an NFA into an equivalent DFA using the subset construction
 * (also known as the powerset construction) algorithm.
 * 
 * Key operations:
 *   - ε-closure(S): set of states reachable from S via ε-transitions
 *   - move(S, a): set of states reachable from S on input symbol a
 */

class SubsetConstruction {
    constructor() {
        this.steps = [];
    }

    /**
     * Compute the ε-closure of a set of NFA states
     * @param {number[]} states - Set of NFA states
     * @param {object} transitions - NFA transition map
     * @returns {number[]} - ε-closure set (sorted)
     */
    epsilonClosure(states, transitions) {
        const closure = new Set(states);
        const stack = [...states];

        while (stack.length > 0) {
            const state = stack.pop();
            const trans = transitions[state] || [];
            for (const t of trans) {
                if (t.symbol === 'ε' && !closure.has(t.to)) {
                    closure.add(t.to);
                    stack.push(t.to);
                }
            }
        }

        return [...closure].sort((a, b) => a - b);
    }

    /**
     * Compute move(S, symbol): states reachable from S on input symbol
     * @param {number[]} states - Set of NFA states
     * @param {string} symbol - Input symbol
     * @param {object} transitions - NFA transition map
     * @returns {number[]} - Set of reachable states (sorted)
     */
    move(states, symbol, transitions) {
        const result = new Set();
        for (const state of states) {
            const trans = transitions[state] || [];
            for (const t of trans) {
                if (t.symbol === symbol) {
                    result.add(t.to);
                }
            }
        }
        return [...result].sort((a, b) => a - b);
    }

    /**
     * Convert NFA to DFA using subset construction
     * @param {object} nfa - NFA = { start, accept, states, transitions, alphabet }
     * @returns {object} DFA = { start, acceptStates, states, transitions, alphabet, stateMap, steps }
     */
    nfaToDFA(nfa) {
        this.steps = [];

        const { start, accept, transitions, alphabet } = nfa;

        // Step 1: Compute ε-closure of start state
        const startClosure = this.epsilonClosure([start], transitions);
        const startKey = this.stateKey(startClosure);

        this.steps.push({
            type: 'initial',
            description: `ε-closure({q${start}}) = {${startClosure.map(s => 'q' + s).join(', ')}}`,
            stateSet: startClosure
        });

        // DFA state tracking
        const dfaStates = new Map(); // key → { id, nfaStates, isAccept }
        const dfaTransitions = {};   // dfaStateId → { symbol → dfaStateId }
        let stateCounter = 0;

        const isAcceptState = (nfaStates) => nfaStates.includes(accept);

        // Create start DFA state
        const startDFAState = {
            id: stateCounter++,
            nfaStates: startClosure,
            isAccept: isAcceptState(startClosure)
        };
        dfaStates.set(startKey, startDFAState);
        dfaTransitions[startDFAState.id] = {};

        // Worklist algorithm
        const worklist = [startKey];
        const processed = new Set();

        while (worklist.length > 0) {
            const currentKey = worklist.shift();
            if (processed.has(currentKey)) continue;
            processed.add(currentKey);

            const currentDFA = dfaStates.get(currentKey);
            const currentNFAStates = currentDFA.nfaStates;

            for (const symbol of alphabet) {
                // Step: move(current, symbol)
                const moveResult = this.move(currentNFAStates, symbol, transitions);
                
                if (moveResult.length === 0) {
                    // Dead state - no transition
                    continue;
                }

                // Step: ε-closure(move result)
                const closure = this.epsilonClosure(moveResult, transitions);
                const closureKey = this.stateKey(closure);

                this.steps.push({
                    type: 'transition',
                    description: `move({${currentNFAStates.map(s => 'q' + s).join(', ')}}, '${symbol}') = {${moveResult.map(s => 'q' + s).join(', ')}}  →  ε-closure = {${closure.map(s => 'q' + s).join(', ')}}`,
                    from: currentDFA.id,
                    symbol: symbol,
                    moveResult: moveResult,
                    closure: closure
                });

                // Check if this DFA state already exists
                if (!dfaStates.has(closureKey)) {
                    const newDFAState = {
                        id: stateCounter++,
                        nfaStates: closure,
                        isAccept: isAcceptState(closure)
                    };
                    dfaStates.set(closureKey, newDFAState);
                    dfaTransitions[newDFAState.id] = {};
                    worklist.push(closureKey);

                    if (newDFAState.isAccept) {
                        this.steps.push({
                            type: 'accept',
                            description: `State D${newDFAState.id} = {${closure.map(s => 'q' + s).join(', ')}} is an ACCEPT state (contains q${accept})`,
                            stateId: newDFAState.id
                        });
                    }
                }

                const targetDFA = dfaStates.get(closureKey);
                dfaTransitions[currentDFA.id][symbol] = targetDFA.id;
            }
        }

        // Build result
        const allStates = [];
        const acceptStates = [];
        const stateMap = {}; // DFA state ID → NFA state set

        for (const [key, state] of dfaStates) {
            allStates.push(state.id);
            stateMap[state.id] = state.nfaStates;
            if (state.isAccept) {
                acceptStates.push(state.id);
            }
        }

        return {
            start: startDFAState.id,
            acceptStates: acceptStates,
            states: allStates.sort((a, b) => a - b),
            transitions: dfaTransitions,
            alphabet: alphabet,
            stateMap: stateMap,
            steps: this.steps
        };
    }

    /**
     * Generate a unique key for a set of NFA states
     */
    stateKey(states) {
        return states.join(',');
    }
}
