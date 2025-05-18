# Biome.js Setup for Unapi

This project uses [Biome.js](https://biomejs.dev/) for linting and formatting to ensure consistent code quality and style across the codebase.

## Getting Started

The Biome.js configuration is already set up in the project. All you need to do is run the appropriate commands to check or fix your code.

### Available Commands

- `pnpm lint` - Check all files for linting issues without fixing them
- `pnpm lint:fix` - Check and automatically fix safe linting issues
- `pnpm format` - Check all files for formatting issues without fixing them
- `pnpm format:fix` - Fix formatting issues in all files

### VS Code Integration

If you're using VS Code, we've preconfigured settings for automatic formatting on save. Make sure you have the Biome VS Code extension installed:

1. Open VS Code
2. Search for "Biome" in extensions
3. Install the "Biome" extension by biomejs

## Configuration

The Biome configuration is stored in `biome.json` at the project root. The main rules we enforce include:

### Linting Rules

- **Correctness**
  - No unused variables
  - No undeclared variables
  - Proper dependency array usage in React hooks

- **Complexity**
  - Limits on cognitive complexity of functions
  - No useless fragments

- **Style**
  - Consistent use of template literals 
  - Consistent array type notation
  - No negation-else patterns

- **Suspicious**
  - No explicit any types 
  - No array index as React keys
  - Warnings for console.log statements

- **Accessibility**
  - Enforce key prop with click events
  - Require alt text for images

### Formatting Rules

- 2-space indentation
- 100 character line width
- Double quotes for strings
- Trailing commas for multiline structures
- Semicolons required

## Common Issues and How to Fix Them

### Unused Variables

If you have unused imports or variables, either:
1. Remove them if they're not needed
2. Use them in your code
3. Prefix with underscore (`_`) if intentionally unused: `_unusedVar`

### Excessive Complexity

When you see "Excessive complexity detected", consider:
1. Breaking the function into smaller, focused functions
2. Reducing nested conditionals
3. Using early returns
4. Extracting complex logic into helper functions

### React-Specific Issues

- Always import React correctly in files that need it
- Properly type React components and their props
- Avoid using index as keys in arrays

## CI Integration

The project has GitHub Actions configured to run Biome checks on all pull requests to ensure code quality before merging. 