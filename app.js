/**
 * app.js
 * 
 * Main Application Controller
 * Ties together all modules: parser, Thompson's construction,
 * subset construction, DFA minimization, rendering, and UI.
 */

// ============================================
// Global State
// ============================================
let currentRegex = '';
let currentNFA = null;
let currentDFA = null;
let currentMinDFA = null;
let testHistory = [];

// Renderers
let nfaRenderer = null;
let dfaRenderer = null;
let minDfaRenderer = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    generateSpiralBinding();
    setupTabs();
    setupKeyboardShortcuts();
    initRenderers();
    updatePageNumber();

    window.addEventListener('resize', () => {
        if (currentNFA && nfaRenderer) { nfaRenderer.doAutoFit(); }
        if (currentDFA && dfaRenderer) { dfaRenderer.doAutoFit(); }
        if (currentMinDFA && minDfaRenderer) { minDfaRenderer.doAutoFit(); }
    });
});

// ============================================
// Spiral Binding Generator
// ============================================
function generateSpiralBinding() {
    const container = document.getElementById('spiral-binding');
    const pageHeight = Math.max(document.body.scrollHeight, window.innerHeight);
    const ringSpacing = 60;
    const numRings = Math.ceil(pageHeight / ringSpacing) + 2;

    for (let i = 0; i < numRings; i++) {
        const ring = document.createElement('div');
        ring.className = 'spiral-ring';
        ring.style.top = `${30 + i * ringSpacing}px`;
        container.appendChild(ring);
    }
}

// ============================================
// Tab Navigation
// ============================================
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${tabName}`).classList.add('active');

    const pageMap = { 'input': 1, 'nfa': 2, 'dfa': 3, 'min-dfa': 4, 'test': 5 };
    document.getElementById('page-number').textContent = `Page ${pageMap[tabName] || 1}`;

    // Re-fit canvases after tab becomes visible (canvas dimensions are now correct)
    setTimeout(() => {
        if (tabName === 'nfa' && nfaRenderer && currentNFA) nfaRenderer.doAutoFit();
        if (tabName === 'dfa' && dfaRenderer && currentDFA) dfaRenderer.doAutoFit();
        if (tabName === 'min-dfa' && minDfaRenderer && currentMinDFA) minDfaRenderer.doAutoFit();
    }, 50);
}

// ============================================
// Keyboard Shortcuts
// ============================================
function setupKeyboardShortcuts() {
    document.getElementById('regex-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') convertRegex();
    });

    document.getElementById('test-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') testString();
    });
}

// ============================================
// Initialize Canvas Renderers
// ============================================
function initRenderers() {
    const nfaCanvas = document.getElementById('nfa-canvas');
    const dfaCanvas = document.getElementById('dfa-canvas');
    const minDfaCanvas = document.getElementById('min-dfa-canvas');

    [nfaCanvas, dfaCanvas, minDfaCanvas].forEach(canvas => {
        canvas.style.width = '100%';
        canvas.style.height = '600px';
    });

    nfaRenderer = new AutomataRenderer(nfaCanvas);
    dfaRenderer = new AutomataRenderer(dfaCanvas);
    minDfaRenderer = new AutomataRenderer(minDfaCanvas);
}

// ============================================
// Main Conversion Pipeline
// ============================================
function convertRegex() {
    const input = document.getElementById('regex-input').value.trim();
    
    if (!input) {
        showError('Please enter a regular expression!');
        return;
    }

    hideError();

    try {
        currentRegex = input;

        // Step 1: Parse regex → AST
        const parser = new RegexParser();
        const ast = parser.parse(input);

        // Step 2: Thompson's Construction → NFA (with BFS renumbering)
        const thompson = new ThompsonConstruction();
        currentNFA = thompson.astToNFA(ast);

        // Step 3: Subset Construction → DFA
        const subsetConst = new SubsetConstruction();
        currentDFA = subsetConst.nfaToDFA(currentNFA);

        // Step 4: Hopcroft Minimization → Min DFA
        const minimizer = new DFAMinimizer();
        currentMinDFA = minimizer.minimize(currentDFA);

        // Switch to NFA tab first (makes canvas visible)
        switchTab('nfa');

        // Build all tables and sections SYNCHRONOUSLY (no requestAnimationFrame)
        // The tab is already switched, so the NFA section is visible
        updateNFASection();
        updateDFASection();
        updateMinDFASection();
        updateTestSection();

        // Clear test history for new regex
        testHistory = [];
        updateHistoryDisplay();

    } catch (error) {
        showError(`Error: ${error.message}`);
        console.error('Conversion error:', error);
    }
}

// ============================================
// NFA Section
// ============================================
function updateNFASection() {
    document.getElementById('nfa-regex-value').textContent = currentRegex;
    buildNFATable();
    displayNFASteps();
    // Render diagram after a small delay (canvas needs to be visible)
    setTimeout(() => nfaRenderer.renderNFA(currentNFA), 60);
}

function buildNFATable() {
    const table = document.getElementById('nfa-transition-table');
    if (!table) return;
    const { states, transitions, alphabet, start, accept } = currentNFA;

    const headerRow = `<tr>
        <th>State</th>
        ${alphabet.map(a => `<th>${a}</th>`).join('')}
        <th>ε</th>
    </tr>`;

    const bodyRows = states.map(state => {
        const trans = transitions[state] || [];
        
        const cells = alphabet.map(symbol => {
            const targets = trans.filter(t => t.symbol === symbol).map(t => `q${t.to}`);
            return `<td>${targets.length > 0 ? `{${targets.join(', ')}}` : '∅'}</td>`;
        });

        const epsilonTargets = trans.filter(t => t.symbol === 'ε').map(t => `q${t.to}`);
        const epsilonCell = `<td>${epsilonTargets.length > 0 ? `{${epsilonTargets.join(', ')}}` : '∅'}</td>`;

        const markers = [];
        if (state === start) markers.push('→');
        if (state === accept) markers.push('*');
        const prefix = markers.length > 0 ? markers.join('') + ' ' : '';

        const stateClass = [];
        if (state === start) stateClass.push('start-state');
        if (state === accept) stateClass.push('accept-state');

        return `<tr>
            <td class="${stateClass.join(' ')}">${prefix}q${state}</td>
            ${cells.join('')}
            ${epsilonCell}
        </tr>`;
    }).join('');

    table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRows}</tbody>`;
}

function displayNFASteps() {
    const list = document.getElementById('nfa-steps-list');
    if (!list) return;
    list.innerHTML = currentNFA.steps.map((step, i) => 
        `<li><strong>Step ${i + 1}:</strong> ${step.description}</li>`
    ).join('');
}

// ============================================
// DFA Section
// ============================================
function updateDFASection() {
    document.getElementById('dfa-regex-value').textContent = currentRegex;
    buildDFATable(currentDFA, 'dfa-transition-table', 'D');
    displayDFASteps();
    setTimeout(() => dfaRenderer.renderDFA(currentDFA, 'D'), 60);
}

function buildDFATable(dfa, tableId, prefix) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const { states, transitions, alphabet, start, acceptStates, stateMap } = dfa;

    const headerRow = `<tr>
        <th>State</th>
        ${stateMap ? '<th>NFA States</th>' : ''}
        ${alphabet.map(a => `<th>${a}</th>`).join('')}
    </tr>`;

    const bodyRows = states.map(state => {
        const trans = transitions[state] || {};
        
        const cells = alphabet.map(symbol => {
            const target = trans[symbol];
            return `<td>${target !== undefined ? `${prefix}${target}` : '—'}</td>`;
        });

        const markers = [];
        if (state === start) markers.push('→');
        if (acceptStates.includes(state)) markers.push('*');
        const markerStr = markers.length > 0 ? markers.join('') + ' ' : '';

        const stateClass = [];
        if (state === start) stateClass.push('start-state');
        if (acceptStates.includes(state)) stateClass.push('accept-state');

        const nfaStatesCell = stateMap ? 
            `<td class="state-set">{${stateMap[state].map(s => 'q' + s).join(', ')}}</td>` : '';

        return `<tr>
            <td class="${stateClass.join(' ')}">${markerStr}${prefix}${state}</td>
            ${nfaStatesCell}
            ${cells.join('')}
        </tr>`;
    }).join('');

    table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRows}</tbody>`;
}

function displayDFASteps() {
    const list = document.getElementById('dfa-steps-list');
    if (!list) return;
    list.innerHTML = currentDFA.steps.map((step, i) => 
        `<li><strong>Step ${i + 1}:</strong> ${step.description}</li>`
    ).join('');
}

// ============================================
// Minimized DFA Section
// ============================================
function updateMinDFASection() {
    document.getElementById('min-dfa-regex-value').textContent = currentRegex;
    buildDFATable(currentMinDFA, 'min-dfa-transition-table', 'M');
    displayMinDFASteps();
    setTimeout(() => minDfaRenderer.renderDFA(currentMinDFA, 'M'), 60);
}

function displayMinDFASteps() {
    const list = document.getElementById('min-dfa-steps-list');
    if (!list) return;
    list.innerHTML = currentMinDFA.steps.map((step, i) => 
        `<li><strong>Step ${i + 1}:</strong> ${step.description}</li>`
    ).join('');
}

// ============================================
// String Testing
// ============================================
function updateTestSection() {
    document.getElementById('test-regex-value').textContent = currentRegex;
}

function testString() {
    if (!currentMinDFA) {
        showError('Please convert a regular expression first!');
        switchTab('input');
        return;
    }

    const input = document.getElementById('test-input').value;
    const testStr = input.toLowerCase(); // Normalize (parser lowercases too)

    const result = simulateDFA(currentMinDFA, testStr);

    const resultDiv = document.getElementById('test-result');
    resultDiv.className = 'test-result';
    
    if (result.accepted) {
        resultDiv.classList.add('accepted');
        resultDiv.innerHTML = `✓ ACCEPTED — "${testStr || 'ε (empty string)'}" is in the language!`;
    } else {
        resultDiv.classList.add('rejected');
        resultDiv.innerHTML = `✕ REJECTED — "${testStr || 'ε (empty string)'}" is NOT in the language!`;
    }

    displayPath(result);

    testHistory.unshift({
        string: testStr,
        accepted: result.accepted,
        path: result.path
    });
    updateHistoryDisplay();

    document.getElementById('test-input').value = '';
}

function simulateDFA(dfa, inputString) {
    const { start, acceptStates, transitions } = dfa;
    let currentState = start;
    const path = [{ state: currentState, symbol: null }];

    for (let i = 0; i < inputString.length; i++) {
        const symbol = inputString[i];
        const trans = transitions[currentState];

        if (!trans || trans[symbol] === undefined) {
            path.push({ state: -1, symbol: symbol });
            return { accepted: false, path: path, deadAt: i };
        }

        currentState = trans[symbol];
        path.push({ state: currentState, symbol: symbol });
    }

    return {
        accepted: acceptStates.includes(currentState),
        path: path,
        finalState: currentState
    };
}

function displayPath(result) {
    const pathDiv = document.getElementById('test-path');
    const pathDisplay = document.getElementById('path-display');
    pathDiv.classList.add('show');

    let html = '';
    for (let i = 0; i < result.path.length; i++) {
        const step = result.path[i];
        const isLast = i === result.path.length - 1;
        const isDead = step.state === -1;

        if (i > 0) {
            html += `<span class="path-symbol">${step.symbol}</span>`;
            html += `<span class="path-arrow">→</span>`;
        }

        if (isDead) {
            html += `<span class="path-state" style="border-color: #d32f2f; color: #d32f2f;">DEAD</span>`;
        } else {
            const isAccept = currentMinDFA.acceptStates.includes(step.state);
            html += `<span class="path-state ${isLast ? 'current' : ''} ${isAccept ? 'accept' : ''}">M${step.state}</span>`;
        }
    }

    pathDisplay.innerHTML = html;
}

function updateHistoryDisplay() {
    const list = document.getElementById('history-list');
    
    if (testHistory.length === 0) {
        list.innerHTML = '<li style="opacity: 0.5; font-style: italic;">No tests yet...</li>';
        return;
    }

    list.innerHTML = testHistory.map(entry => {
        const icon = entry.accepted ? '✓' : '✕';
        const iconClass = entry.accepted ? 'accepted' : 'rejected';
        const label = entry.accepted ? 'Accepted' : 'Rejected';
        const displayStr = entry.string === '' ? 'ε (empty)' : `"${entry.string}"`;

        return `<li>
            <span class="history-icon ${iconClass}">${icon}</span>
            <span class="history-string">${displayStr}</span>
            <span class="history-label ${iconClass}">${label}</span>
        </li>`;
    }).join('');
}

function clearHistory() {
    testHistory = [];
    updateHistoryDisplay();
    document.getElementById('test-result').className = 'test-result';
    document.getElementById('test-path').classList.remove('show');
}

// ============================================
// Utility Functions
// ============================================
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.classList.remove('show');
}

function clearAll() {
    document.getElementById('regex-input').value = '';
    currentRegex = '';
    currentNFA = null;
    currentDFA = null;
    currentMinDFA = null;
    testHistory = [];
    hideError();

    ['nfa', 'dfa', 'min-dfa'].forEach(type => {
        const canvas = document.getElementById(`${type}-canvas`);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    switchTab('input');
}

function loadExample() {
    document.getElementById('regex-input').value = '(a|b)*abb';
    hideError();
}

function updatePageNumber() {}

// ============================================
// Canvas Zoom Controls
// ============================================
function zoomIn(type) {
    const r = { 'nfa': nfaRenderer, 'dfa': dfaRenderer, 'min-dfa': minDfaRenderer }[type];
    if (r) r.zoomIn();
}

function zoomOut(type) {
    const r = { 'nfa': nfaRenderer, 'dfa': dfaRenderer, 'min-dfa': minDfaRenderer }[type];
    if (r) r.zoomOut();
}

function resetView(type) {
    const r = { 'nfa': nfaRenderer, 'dfa': dfaRenderer, 'min-dfa': minDfaRenderer }[type];
    if (r) r.resetView();
}
