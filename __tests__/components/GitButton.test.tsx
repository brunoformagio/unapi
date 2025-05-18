/// <reference types="@testing-library/jest-dom" />
import { GitButton } from "@/components/GitButton";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("GitButton", () => {
  it("renders the GitHub link correctly", () => {
    render(<GitButton />);

    // Find the GitHub link
    const link = screen.getByRole("link");

    // Check link attributes
    expect(link).toHaveAttribute("href", "https://github.com/brunoformagio/unapi");
    expect(link).toHaveAttribute("target", "_blank");

    // Verify the SVG is present
    expect(link.querySelector("svg")).toBeInTheDocument();
  });
});
