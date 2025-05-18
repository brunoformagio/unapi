/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

// This file is intentionally empty - importing '@testing-library/jest-dom'
// will automatically extend Jest's matchers

declare namespace jest {
  interface Expect {
    toBeInTheDocument(): void;
    toHaveClass(className: string): void;
    toBeDisabled(): void;
  }
}
