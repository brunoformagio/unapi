# Testing Guide for Unapi

This document outlines the testing approach for the Unapi project, including how to run tests, add new tests, and understand the testing structure.

## Testing Setup

Unapi uses Vitest as the testing framework with React Testing Library for component testing. The project also uses Mock Service Worker (MSW) for API mocking.

### Key Dependencies

- **Vitest**: Fast Vite-based JavaScript Testing Framework
- **React Testing Library**: For testing React components
- **MSW (Mock Service Worker)**: For mocking API requests
- **JSDOM**: For simulating browser environment

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (good for development)
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## Test Directory Structure

Tests are organized under the `__tests__` directory, mirroring the project structure:

```
__tests__/
  components/       # Tests for React components
  lib/              # Tests for utility functions and libraries
  integration/      # Integration tests that test multiple components together
```

## Writing Tests

### Unit Tests

Unit tests should focus on testing a single function or component in isolation. Use mocks for dependencies.

Example for testing a utility function:

```typescript
import { describe, it, expect } from 'vitest';
import { someFunction } from '@/lib/utils';

describe('someFunction', () => {
  it('should handle normal case', () => {
    expect(someFunction('input')).toEqual('expected output');
  });

  it('should handle edge case', () => {
    expect(someFunction('')).toEqual('default value');
  });
});
```

### Component Tests

For React components, use React Testing Library to test rendering and behavior:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click Me');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

Integration tests check how multiple components or functions work together:

```typescript
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import SomeComponent from '@/components/SomeComponent';

// Setup mock server for API calls
const server = setupServer(
  rest.get('/api/data', (req, res, ctx) => {
    return res(ctx.json({ message: 'Success' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('component loads data and displays it', async () => {
  render(<SomeComponent />);
  
  // Wait for data to load and be displayed
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

## Mocking

### API Mocking with MSW

For tests that require API calls, use MSW to mock the responses:

```typescript
// Setup a mock server
const server = setupServer(
  rest.post('/api/endpoint', (req, res, ctx) => {
    return res(ctx.json({ data: 'mock response' }));
  })
);

// Start/stop the server for tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Mocking Modules

To mock entire modules:

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('@/lib/someModule', () => ({
  someFunction: vi.fn().mockReturnValue('mocked value')
}));
```

## Best Practices

1. **Test behavior, not implementation**: Focus on what the code does, not how it's written
2. **Use descriptive test names**: Clearly describe what each test is checking
3. **Keep tests independent**: Tests should not depend on each other
4. **Mock external dependencies**: Use mocks for APIs, databases, etc.
5. **Test error handling**: Check how your code handles errors
6. **Maintain test coverage**: Aim for high test coverage of critical code paths

## Troubleshooting

### Common Issues

- **Vitest can't find modules**: Make sure module paths are correct and the alias configuration in vitest.config.ts is properly set up
- **Tests timing out**: For async tests, ensure you're properly using async/await or .then() and waiting for operations to complete
- **MSW not mocking requests**: Check if the server is properly set up and the route patterns match your API calls

### Debugging

To debug tests:
1. Use `console.log()` statements in your tests
2. Run a single test file with `pnpm test path/to/file.test.ts` 
3. Use the `--ui` flag for the Vitest UI: `pnpm vitest --ui` 