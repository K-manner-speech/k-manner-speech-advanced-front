import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { HomePage } from "./HomePage";

vi.mock("../../api/service", () => ({
  api: { me: vi.fn().mockResolvedValue({ profile: { display_name: "학습자" } }) },
}));

test("피드백 모아보기는 R00 결과 목록 경로로 연결된다", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("link", { name: /피드백 모아보기/ })).toHaveAttribute("href", "/results");
});
