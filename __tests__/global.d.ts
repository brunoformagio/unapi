import "@jest/globals";
import "@testing-library/jest-dom";

/// <reference types="@testing-library/jest-dom" />

declare global {
  const jest: typeof import("@jest/globals")["jest"];
  const describe: typeof import("@jest/globals")["describe"];
  const it: typeof import("@jest/globals")["it"];
  const test: typeof import("@jest/globals")["test"];
  const expect: typeof import("@jest/globals")["expect"];
  const beforeAll: typeof import("@jest/globals")["beforeAll"];
  const afterAll: typeof import("@jest/globals")["afterAll"];
  const beforeEach: typeof import("@jest/globals")["beforeEach"];
  const afterEach: typeof import("@jest/globals")["afterEach"];

  namespace jest {
    interface Matchers<R, T> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toBeDisabled(): R;
    }
  }
}
