# RegEx to Automata Converter

An interactive, notebook-style web app that converts a regular expression into an NFA, DFA, and minimized DFA, then lets you test strings against the final machine.

## Overview

This project is built for the FLAT CS224 course as a visual learning tool for formal languages and automata theory. It walks through the complete regex-to-automata pipeline using:

- Thompson's Construction for NFA generation
- Subset Construction for DFA conversion
- DFA Minimization for reducing states
- String testing on the minimized DFA
- Step-by-step visual explanations and transition tables

## Features

- Enter a regular expression and generate automata instantly
- View the NFA, DFA, and minimized DFA in separate notebook-style tabs
- Inspect transition tables for each automaton
- Read construction and minimization steps in order
- Test input strings against the minimized DFA
- Track test history and traversal paths
- Zoom, reset, and fit automata diagrams on canvas
- Fully static frontend with no build step required

## Supported Regex Syntax

| Syntax | Meaning |
| --- | --- |
| `a`, `b`, `c` | Literal symbols |
| `|` or `+` | Union / OR |
| `*` | Kleene star |
| `?` | Optional, zero or one |
| `( )` | Grouping |
| `ab` | Implicit concatenation |

Example: `(a|b)*abb`

## How It Works

1. The regex is parsed into an abstract syntax tree.
2. Thompson's Construction converts the AST into an NFA.
3. Subset Construction converts the NFA into a DFA.
4. Hopcroft-style minimization reduces the DFA.
5. The minimized DFA is used to test input strings.

## Project Structure

```text
index.html
styles.css
app.js
regex-parser.js
thompson.js
subset-construction.js
dfa-minimizer.js
automata-renderer.js
```

### File Roles

- `index.html` - Main UI and page structure
- `styles.css` - Notebook-inspired styling and layout
- `app.js` - Main controller that connects parsing, construction, rendering, and testing
- `regex-parser.js` - Parses regex input into an AST
- `thompson.js` - Builds the NFA from the AST
- `subset-construction.js` - Builds the DFA from the NFA
- `dfa-minimizer.js` - Minimizes the DFA
- `automata-renderer.js` - Draws automata on canvas

## Running The Project

No installation is required. This is a static HTML, CSS, and JavaScript project.

### Option 1: Open Directly

Open `index.html` in a browser.

### Option 2: Use Live Server

If your browser blocks local file access, open the project in VS Code and run it with Live Server or another local HTTP server.

## Usage

1. Open the **Input** tab.
2. Enter a regex such as `(a|b)*abb`.
3. Click **Convert!** to generate the NFA, DFA, and minimized DFA.
4. Switch between tabs to inspect each automaton.
5. Use the **Test** tab to check whether strings are accepted.

## Example

Try this regex:

```text
(a|b)*abb
```

It builds automata for strings over `a` and `b` that end with `abb`.

## Notes

- The app is designed for lowercase input symbols.
- The regex parser normalizes input before simulation.
- The minimized DFA is the one used for string testing.

## Course Project

This repository is a formal languages and automata theory project focused on making regex-to-automata conversion easier to understand through visualization.
