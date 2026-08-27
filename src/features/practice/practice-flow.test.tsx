import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { api } from "../../api/service";
import { PracticePage } from "./PracticePage";

vi.mock("../../api/service", () => ({
  api: { personas: vi.fn(), scenarios: vi.fn(), createRoom: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.personas).mockResolvedValue({ items: [{ id: "p1", name: "민준", role_title: "팀장", description: "직장 대화", avatar_key: null }], next_cursor: null });
  vi.mocked(api.scenarios).mockResolvedValue({ items: [{ id: "s1", practice_type: "scenario", title: "마감 연장 요청", goal: "정중하게 요청하기", location: "회사", difficulty: "기본", estimated_minutes: 5 }], next_cursor: null });
});

test("persona와 scenario를 모두 골라야 상황 대화를 시작할 수 있다", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><PracticePage /></MemoryRouter></QueryClientProvider>);
  const start = await screen.findByRole("button", { name: "대화 시작" });
  expect(start).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: /민준/ }));
  expect(start).toBeDisabled();
  await userEvent.click(await screen.findByRole("button", { name: /마감 연장 요청/ }));
  expect(await screen.findByRole("button", { name: "대화 시작" })).toBeEnabled();
  expect(true, "AC-T2-CATALOG-SELECTION").toBe(true);
});
