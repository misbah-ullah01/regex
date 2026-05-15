/**
 * automata-renderer.js
 * 
 * Hand-drawn style automata diagram renderer using HTML5 Canvas
 * Renders NFA and DFA state diagrams with a sketchy, notebook aesthetic
 * 
 * LARGE & CLEAR version — designed for classroom projector visibility
 */

class AutomataRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Design tokens
        this.colors = {
            ink: '#1a2332',
            accent: '#c0392b',
            green: '#27AE60',
            paper: '#FDF5E6',
            lightBlue: '#BDD7EE',
            gray: '#74777f',
            stateFill: '#FFFDF5',
            labelBg: 'rgba(253, 245, 230, 0.95)',
            startArrow: '#2563eb'
        };

        this.stateRadius = 32;
        this.fontSize = 20;
        this.labelFontSize = 18;
        this.lineWidth = 2.5;
        this.arrowHeadLen = 13;

        // Enable panning & zooming
        this.setupInteraction();
    }

    setupInteraction() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.redraw();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.1, Math.min(8, this.scale * zoomFactor));

            // Zoom towards mouse pointer
            this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
            this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
            this.scale = newScale;

            this.redraw();
        });
    }

    // =============================================
    // PUBLIC API
    // =============================================

    renderNFA(nfa) {
        this.automata = nfa;
        this.automataType = 'nfa';
        this.statePrefix = 'q';
        this.acceptStates = [nfa.accept];
        this.positions = this.calculatePositions(nfa.states, nfa.transitions, nfa.start, [nfa.accept]);
        this.doAutoFit();
    }

    renderDFA(dfa, prefix = 'D') {
        this.automata = dfa;
        this.automataType = 'dfa';
        this.statePrefix = prefix;
        this.acceptStates = dfa.acceptStates;
        this.positions = this.calculatePositions(dfa.states, dfa.transitions, dfa.start, dfa.acceptStates);
        this.doAutoFit();
    }

    doAutoFit() {
        this.computeAutoFit();
        this.redraw();
    }

    // =============================================
    // LAYOUT ALGORITHM
    // =============================================

    /**
     * Calculate state positions using BFS layered layout.
     * Positions are computed in an abstract coordinate system; 
     * auto-fit then maps them into the visible canvas.
     */
    calculatePositions(states, transitions, startState, acceptStates) {
        const positions = {};
        const n = states.length;
        if (n === 0) return positions;

        // Use extra-generous spacing: each node gets a large area
        const SPACING = this.stateRadius * 6;

        if (n === 1) {
            positions[states[0]] = { x: 0, y: 0 };
            return positions;
        }

        if (n === 2) {
            positions[states[0]] = { x: 0, y: 0 };
            positions[states[1]] = { x: SPACING * 2, y: 0 };
            return positions;
        }

        // BFS layered layout from start state
        const layers = this.bfsLayers(states, transitions, startState);
        const numLayers = layers.length;

        for (let li = 0; li < numLayers; li++) {
            const layer = layers[li];
            const x = li * SPACING * 2;
            const totalH = (layer.length - 1) * SPACING;
            const startY = -totalH / 2;

            for (let ni = 0; ni < layer.length; ni++) {
                positions[layer[ni]] = {
                    x: x,
                    y: startY + ni * SPACING
                };
            }
        }

        // Force-based repulsion to prevent overlaps
        this.applyForceRepulsion(positions, states);

        return positions;
    }

    /**
     * Force repulsion to prevent overlapping states
     */
    applyForceRepulsion(positions, states) {
        const minDist = this.stateRadius * 4.8;
        for (let iter = 0; iter < 120; iter++) {
            let moved = false;
            for (let i = 0; i < states.length; i++) {
                for (let j = i + 1; j < states.length; j++) {
                    const a = positions[states[i]];
                    const b = positions[states[j]];
                    if (!a || !b) continue;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist && dist > 0.01) {
                        const push = (minDist - dist) / 2 + 4;
                        const ux = dx / dist;
                        const uy = dy / dist;
                        a.x -= ux * push * 0.6;
                        a.y -= uy * push * 0.6;
                        b.x += ux * push * 0.6;
                        b.y += uy * push * 0.6;
                        moved = true;
                    }
                }
            }
            if (!moved) break;
        }
    }

    /**
     * BFS to create layers from start state
     */
    bfsLayers(states, transitions, startState) {
        const visited = new Set();
        const layers = [];
        let currentLayer = [startState];
        visited.add(startState);

        while (currentLayer.length > 0) {
            layers.push(currentLayer);
            const nextLayer = [];

            for (const state of currentLayer) {
                const trans = transitions[state];
                if (Array.isArray(trans)) {
                    for (const t of trans) {
                        if (!visited.has(t.to)) {
                            visited.add(t.to);
                            nextLayer.push(t.to);
                        }
                    }
                } else if (trans && typeof trans === 'object') {
                    for (const symbol of Object.keys(trans)) {
                        const target = trans[symbol];
                        if (target !== undefined && !visited.has(target)) {
                            visited.add(target);
                            nextLayer.push(target);
                        }
                    }
                }
            }

            currentLayer = nextLayer;
        }

        // Any states not reached by BFS
        const remaining = states.filter(s => !visited.has(s));
        if (remaining.length > 0) {
            layers.push(remaining);
        }

        return layers;
    }

    // =============================================
    // AUTO-FIT
    // =============================================

    computeAutoFit() {
        const positions = this.positions;
        const keys = Object.keys(positions);
        if (keys.length === 0) return;

        // Compute bounding box of all state positions
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const k of keys) {
            const p = positions[k];
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        // Generous padding for circles, labels, start arrow
        const pad = this.stateRadius * 2.5 + 80;
        const contentW = Math.max(maxX - minX + pad * 2, 200);
        const contentH = Math.max(maxY - minY + pad * 2, 200);

        // Get actual canvas CSS size
        const rect = this.canvas.getBoundingClientRect();
        const canvasW = Math.max(rect.width, 600);
        const canvasH = Math.max(rect.height, 400);

        // Scale to fit while leaving margin
        const scaleX = (canvasW * 0.92) / contentW;
        const scaleY = (canvasH * 0.92) / contentH;
        this.scale = Math.min(scaleX, scaleY);

        // Allow scaling up to fill the canvas (important for small graphs!)
        this.scale = Math.min(this.scale, 3.5);
        this.scale = Math.max(this.scale, 0.2);

        // Center
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        this.offsetX = canvasW / 2 - cx * this.scale;
        this.offsetY = canvasH / 2 - cy * this.scale;
    }

    // =============================================
    // MAIN DRAW
    // =============================================

    redraw() {
        if (!this.automata) return;

        const ctx = this.ctx;
        const canvas = this.canvas;

        // Get actual display size
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 5) return; // hidden

        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Paper background
        ctx.fillStyle = this.colors.paper;
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Ruled lines
        ctx.save();
        ctx.strokeStyle = this.colors.lightBlue;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.15;
        for (let y = 0; y < rect.height; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(rect.width, y);
            ctx.stroke();
        }
        ctx.restore();

        // Apply pan + zoom
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        const { transitions, start } = this.automata;

        // 1. Draw transition arrows first (behind states)
        this.drawAllTransitions(transitions);

        // 2. Start arrow
        if (this.positions[start]) {
            this.drawStartArrow(this.positions[start]);
        }

        // 3. Draw states on top
        for (const state of this.automata.states) {
            if (!this.positions[state]) continue;
            const pos = this.positions[state];
            const isAccept = this.acceptStates.includes(state);
            this.drawState(pos.x, pos.y, `${this.statePrefix}${state}`, isAccept);
        }

        ctx.restore();
    }

    // =============================================
    // STATE DRAWING
    // =============================================

    drawState(x, y, label, isAccept) {
        const ctx = this.ctx;
        const r = this.stateRadius;

        // Hand-drawn outer circle
        ctx.beginPath();
        this.traceWobblyCircle(ctx, x, y, r);
        ctx.fillStyle = this.colors.stateFill;
        ctx.fill();
        ctx.strokeStyle = this.colors.ink;
        ctx.lineWidth = this.lineWidth;
        ctx.stroke();

        // Accept: double-ring
        if (isAccept) {
            ctx.beginPath();
            this.traceWobblyCircle(ctx, x, y, r - 6);
            ctx.strokeStyle = this.colors.green;
            ctx.lineWidth = this.lineWidth;
            ctx.stroke();
        }

        // Label
        ctx.fillStyle = this.colors.ink;
        ctx.font = `bold ${this.fontSize}px 'Caveat', cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 1);
    }

    traceWobblyCircle(ctx, cx, cy, radius) {
        const segs = 48;
        const wobble = 1.0;
        for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const w = Math.sin(i * 4.1) * wobble + Math.cos(i * 2.7) * wobble * 0.4;
            const r = radius + w;
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    // =============================================
    // START ARROW
    // =============================================

    drawStartArrow(pos) {
        const ctx = this.ctx;
        const r = this.stateRadius;
        const arrowLen = r * 1.8;
        const sx = pos.x - r - arrowLen;
        const sy = pos.y;
        const ex = pos.x - r - 3;

        // Slight curve
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const mid = (sx + ex) / 2;
        ctx.quadraticCurveTo(mid, sy - 1, ex, sy);
        ctx.strokeStyle = this.colors.startArrow;
        ctx.lineWidth = this.lineWidth + 0.8;
        ctx.stroke();

        this.drawArrowhead(ctx, ex, sy, 0, this.colors.startArrow);

        // "start" label with better visibility
        ctx.fillStyle = this.colors.gray;
        ctx.font = `italic ${this.labelFontSize - 2}px 'Caveat', cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('start', sx + arrowLen / 2, sy - 10);
    }

    // =============================================
    // TRANSITIONS
    // =============================================

    drawAllTransitions(transitions) {
        // Group transitions between the same (from, to) pair
        const edgeMap = new Map();

        if (this.automataType === 'nfa') {
            for (const state of this.automata.states) {
                const trans = transitions[state] || [];
                for (const t of trans) {
                    const key = `${state}→${t.to}`;
                    if (!edgeMap.has(key)) {
                        edgeMap.set(key, { from: state, to: t.to, symbols: [] });
                    }
                    const sym = t.symbol;
                    if (!edgeMap.get(key).symbols.includes(sym)) {
                        edgeMap.get(key).symbols.push(sym);
                    }
                }
            }
        } else {
            for (const state of this.automata.states) {
                const trans = transitions[state] || {};
                for (const symbol of Object.keys(trans)) {
                    const target = trans[symbol];
                    if (target === undefined) continue;
                    const key = `${state}→${target}`;
                    if (!edgeMap.has(key)) {
                        edgeMap.set(key, { from: state, to: target, symbols: [] });
                    }
                    edgeMap.get(key).symbols.push(symbol);
                }
            }
        }

        // Detect bidirectional edges to offset them
        const biDir = new Set();
        for (const [key, edge] of edgeMap) {
            const revKey = `${edge.to}→${edge.from}`;
            if (edgeMap.has(revKey) && edge.from !== edge.to) {
                biDir.add(key);
            }
        }

        // Count edges from each state to offset labels
        const edgeFromCount = new Map();
        for (const [key, edge] of edgeMap) {
            const cnt = edgeFromCount.get(edge.from) || 0;
            edgeFromCount.set(edge.from, cnt + 1);
        }

        // Draw each edge
        let edgeIdx = 0;
        for (const [key, edge] of edgeMap) {
            const fromPos = this.positions[edge.from];
            const toPos = this.positions[edge.to];
            if (!fromPos || !toPos) continue;

            const label = edge.symbols.join(', ');

            if (edge.from === edge.to) {
                this.drawSelfLoop(fromPos, label);
            } else if (biDir.has(key)) {
                const curveDir = edge.from < edge.to ? 35 : -35;
                this.drawCurvedArrow(fromPos, toPos, label, curveDir);
            } else {
                this.drawStraightArrow(fromPos, toPos, label);
            }
            edgeIdx++;
        }
    }

    // =============================================
    // STRAIGHT ARROW
    // =============================================

    drawStraightArrow(from, to, label) {
        const ctx = this.ctx;
        const r = this.stateRadius;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) return;

        const ux = dx / dist;
        const uy = dy / dist;

        const sx = from.x + ux * (r + 4);
        const sy = from.y + uy * (r + 4);
        const ex = to.x - ux * (r + 6);
        const ey = to.y - uy * (r + 6);

        // Minimal wobble for clarity
        const wobble = 1;
        const midX = (sx + ex) / 2 + (-uy) * wobble;
        const midY = (sy + ey) / 2 + ux * wobble;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(midX, midY, ex, ey);
        ctx.strokeStyle = this.colors.ink;
        ctx.lineWidth = this.lineWidth + 0.2;
        ctx.stroke();

        const angle = Math.atan2(ey - midY, ex - midX);
        this.drawArrowhead(ctx, ex, ey, angle);

        // Label WELL ABOVE the line — large offset perpendicular to line direction
        const labelOffset = 38;
        const perpX = -uy * labelOffset;
        const perpY = ux * labelOffset;
        this.drawEdgeLabel(midX + perpX, midY + perpY, label);
    }

    // =============================================
    // CURVED ARROW (bidirectional)
    // =============================================

    drawCurvedArrow(from, to, label, curvature) {
        const ctx = this.ctx;
        const r = this.stateRadius;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) return;

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const perpX = -dy / dist * curvature;
        const perpY = dx / dist * curvature;
        const cpX = midX + perpX;
        const cpY = midY + perpY;

        const sAngle = Math.atan2(cpY - from.y, cpX - from.x);
        const sx = from.x + Math.cos(sAngle) * (r + 4);
        const sy = from.y + Math.sin(sAngle) * (r + 4);

        const eAngle = Math.atan2(cpY - to.y, cpX - to.x);
        const ex = to.x + Math.cos(eAngle) * (r + 6);
        const ey = to.y + Math.sin(eAngle) * (r + 6);

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpX, cpY, ex, ey);
        ctx.strokeStyle = this.colors.ink;
        ctx.lineWidth = this.lineWidth + 0.2;
        ctx.stroke();

        const angle = Math.atan2(ey - cpY, ex - cpX);
        this.drawArrowhead(ctx, ex, ey, angle);

        // Label offset well away from curve
        const labelOff = 32;
        const cpPerpX = -dy / dist * (curvature > 0 ? labelOff : -labelOff);
        const cpPerpY = dx / dist * (curvature > 0 ? labelOff : -labelOff);
        this.drawEdgeLabel(cpX + cpPerpX * 0.35, cpY + cpPerpY * 0.35 - 16, label);
    }

    // =============================================
    // SELF-LOOP (circular arc above state)
    // =============================================

    drawSelfLoop(pos, label) {
        const ctx = this.ctx;
        const r = this.stateRadius;
        const loopR = r * 0.75;

        // Position loop above the state
        const cx = pos.x;
        const cy = pos.y - r - loopR + 2;

        // Draw an arc (nearly full circle, opening at bottom)
        ctx.beginPath();
        const startAngle = 0.4;
        const endAngle = Math.PI * 2 - 0.1;
        ctx.arc(cx, cy, loopR, startAngle, endAngle, false);
        ctx.strokeStyle = this.colors.ink;
        ctx.lineWidth = this.lineWidth + 0.3;
        ctx.stroke();

        // Arrowhead at the end of the arc
        const ax = cx + Math.cos(endAngle) * loopR;
        const ay = cy + Math.sin(endAngle) * loopR;
        const tangent = endAngle + Math.PI / 2;
        this.drawArrowhead(ctx, ax, ay, tangent);

        // Label well above loop
        this.drawEdgeLabel(cx, cy - loopR - 18, label);
    }

    // =============================================
    // ARROWHEAD
    // =============================================

    drawArrowhead(ctx, x, y, angle, color) {
        const len = this.arrowHeadLen + 2;
        const half = Math.PI / 5.5;

        const x1 = x - len * Math.cos(angle - half);
        const y1 = y - len * Math.sin(angle - half);
        const x2 = x - len * Math.cos(angle + half);
        const y2 = y - len * Math.sin(angle + half);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fillStyle = color || this.colors.ink;
        ctx.fill();
    }

    // =============================================
    // EDGE LABEL
    // =============================================

    drawEdgeLabel(x, y, text) {
        const ctx = this.ctx;

        ctx.font = `bold ${this.labelFontSize}px 'Caveat', cursive`;
        const metrics = ctx.measureText(text);
        const pad = 7;
        const w = metrics.width + pad * 2;
        const h = this.labelFontSize + pad * 2;

        // Background rounded rect with stronger fill
        ctx.fillStyle = this.colors.labelBg;
        this.roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
        ctx.fill();

        // Visible border
        ctx.strokeStyle = 'rgba(192, 57, 43, 0.3)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
        ctx.stroke();

        // Text with shadow for better readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillText(text, x + 0.5, y + 0.5);

        ctx.fillStyle = this.colors.accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // =============================================
    // ZOOM CONTROLS
    // =============================================

    zoomIn() {
        this.scale = Math.min(8, this.scale * 1.3);
        this.redraw();
    }

    zoomOut() {
        this.scale = Math.max(0.1, this.scale * 0.75);
        this.redraw();
    }

    resetView() {
        if (this.automata) {
            this.computeAutoFit();
        } else {
            this.scale = 1;
            this.offsetX = 0;
            this.offsetY = 0;
        }
        this.redraw();
    }
}
