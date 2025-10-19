import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockResolvedValue({
    ok: true,
    text: () => Promise.resolve("OK")
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("App", () => {
  it("renders health status", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText(/API:/)).toBeInTheDocument());
    expect(screen.getByText(/Web App: OK/)).toBeInTheDocument();
    expect(screen.getByText(/API: OK/)).toBeInTheDocument();
  });
});
