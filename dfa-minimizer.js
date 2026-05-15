/**
 * dfa-minimizer.js
 * 
 * DFA Minimization using Hopcroft's Algorithm (Table-Filling / Partition Refinement)
 * 
 * Minimizes a DFA by:
 * 1. Removing unreachable states
 * 2. Merging equivalent (indistinguishable) states using partition refinement
 */

class DFAMinimizer {
    constructor() {
        this.steps = [];
    }

    /**
     * Minimize a DFA
     * @param {object} dfa - DFA = { start, acceptStates, states, transitions, alphabet }
     * @returns {object} Minimized DFA with same structure + steps
     */
    minimize(dfa) {
        this.steps = [];
        const { start, acceptStates, states, transitions, alphabet } = dfa;

        // Step 1: Remove unreachable states
        const reachable = this.findReachableStates(start, transitions, states);
        
        this.steps.push({
            type: 'reachable',
            description: `Reachable states from D${start}: {${reachable.map(s => 'D' + s).join(', ')}}`,
            states: reachable
        });

        const reachableAccept = acceptStates.filter(s => reachable.includes(s));
        const reachableNonAccept = reachable.filter(s => !acceptStates.includes(s));

        // Step 2: Initial partition: {accept states} and {non-accept states}
        let partitions = [];
        if (reachableNonAccept.length > 0) {
            partitions.push(reachableNonAccept);
        }
        if (reachableAccept.length > 0) {
            partitions.push(reachableAccept);
        }

        this.steps.push({
            type: 'initial-partition',
            description: `Initial partition: P0 = { ${partitions.map((p, i) => `{${p.map(s => 'D' + s).join(', ')}}`).join(' , ')} }`,
            partitions: partitions.map(p => [...p])
        });

        // Step 3: Refine partitions
        let changed = true;
        let iteration = 0;

        while (changed) {
            changed = false;
            const newPartitions = [];

            for (const group of partitions) {
                const split = this.splitGroup(group, partitions, transitions, alphabet);
                
                if (split.length > 1) {
                    changed = true;
                    this.steps.push({
                        type: 'split',
                        description: `Split {${group.map(s => 'D' + s).join(', ')}} into: ${split.map(g => `{${g.map(s => 'D' + s).join(', ')}}`).join(' and ')}`,
                        original: [...group],
                        result: split.map(g => [...g])
                    });
                }

                newPartitions.push(...split);
            }

            partitions = newPartitions;
            iteration++;

            if (iteration > 100) break; // Safety
        }

        this.steps.push({
            type: 'final-partition',
            description: `Final partition: { ${partitions.map(p => `{${p.map(s => 'D' + s).join(', ')}}`).join(' , ')} }`,
            partitions: partitions.map(p => [...p])
        });

        // Step 4: Build minimized DFA
        return this.buildMinimizedDFA(partitions, dfa, reachable);
    }

    /**
     * Find all states reachable from the start state
     */
    findReachableStates(start, transitions, allStates) {
        const reachable = new Set();
        const stack = [start];

        while (stack.length > 0) {
            const state = stack.pop();
            if (reachable.has(state)) continue;
            reachable.add(state);

            const trans = transitions[state];
            if (trans) {
                for (const symbol of Object.keys(trans)) {
                    const target = trans[symbol];
                    if (target !== undefined && !reachable.has(target)) {
                        stack.push(target);
                    }
                }
            }
        }

        return [...reachable].sort((a, b) => a - b);
    }

    /**
     * Try to split a group based on transition behavior
     */
    splitGroup(group, partitions, transitions, alphabet) {
        if (group.length <= 1) return [group];

        const representative = group[0];
        const subgroups = new Map(); // signature → [states]

        for (const state of group) {
            const signature = this.getSignature(state, partitions, transitions, alphabet);
            const key = signature.join(',');
            
            if (!subgroups.has(key)) {
                subgroups.set(key, []);
            }
            subgroups.get(key).push(state);
        }

        return [...subgroups.values()];
    }

    /**
     * Get the partition signature of a state
     * (which partition each transition leads to)
     */
    getSignature(state, partitions, transitions, alphabet) {
        const sig = [];
        for (const symbol of alphabet) {
            const target = transitions[state] ? transitions[state][symbol] : undefined;
            
            if (target === undefined) {
                sig.push(-1); // Dead state / trap
            } else {
                // Find which partition the target belongs to
                const partIdx = partitions.findIndex(p => p.includes(target));
                sig.push(partIdx);
            }
        }
        return sig;
    }

    /**
     * Build the minimized DFA from the final partitions
     */
    buildMinimizedDFA(partitions, originalDFA, reachableStates) {
        const { start, acceptStates, transitions, alphabet, stateMap } = originalDFA;

        // Map each old state to its partition index
        const stateToPartition = {};
        for (let i = 0; i < partitions.length; i++) {
            for (const state of partitions[i]) {
                stateToPartition[state] = i;
            }
        }

        // Build new transitions
        const newTransitions = {};
        const newAcceptStates = [];
        const newStates = [];
        let newStart = stateToPartition[start];

        // Build new state map (for display)
        const newStateMap = {};

        for (let i = 0; i < partitions.length; i++) {
            newStates.push(i);
            newTransitions[i] = {};

            // Check if this partition contains an accept state
            if (partitions[i].some(s => acceptStates.includes(s))) {
                newAcceptStates.push(i);
            }

            // Build transitions from representative
            const representative = partitions[i][0];
            for (const symbol of alphabet) {
                const target = transitions[representative] ? transitions[representative][symbol] : undefined;
                if (target !== undefined) {
                    newTransitions[i][symbol] = stateToPartition[target];
                }
            }

            // Merge state maps for display
            if (stateMap) {
                const mergedNFAStates = new Set();
                for (const dfaState of partitions[i]) {
                    if (stateMap[dfaState]) {
                        for (const nfaState of stateMap[dfaState]) {
                            mergedNFAStates.add(nfaState);
                        }
                    }
                }
                newStateMap[i] = [...mergedNFAStates].sort((a, b) => a - b);
            }
        }

        this.steps.push({
            type: 'result',
            description: `Minimized DFA has ${newStates.length} states (reduced from ${reachableStates.length}). Start: M${newStart}, Accept: {${newAcceptStates.map(s => 'M' + s).join(', ')}}`,
            stateCount: newStates.length,
            originalCount: reachableStates.length
        });

        return {
            start: newStart,
            acceptStates: newAcceptStates,
            states: newStates,
            transitions: newTransitions,
            alphabet: alphabet,
            stateMap: newStateMap,
            partitions: partitions,
            steps: this.steps
        };
    }
}
