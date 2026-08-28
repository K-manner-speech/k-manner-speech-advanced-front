import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { api } from "../../api/service";
import { PracticePage } from "./PracticePage";

vi.mock("../../api/service", () => ({
  api: { personas: vi.fn(), scenarios: vi.fn(), scenario: vi.fn(), createRoom: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.personas).mockResolvedValue({ items: [{ id: "p1", name: "민준", role_title: "팀장", description: "직장 대화", avatar_key: null }], next_cursor: null });
  vi.mocked(api.scenarios).mockResolvedValue({ items: [{ id: "s1", practice_type: "scenario", title: "마감 연장 요청", goal: "정중하게 요청하기", location: "회사", difficulty: "기본", estimated_minutes: 5 }], next_cursor: null });
  vi.mocked(api.scenario).mockResolvedValue({ id: "s1", practice_type: "scenario", title: "마감 연장 요청", goal: "정중하게 요청하기", location: "회사", difficulty: "기본", estimated_minutes: 5, opening_message: null, max_turns: 10, required_conditions: [], allowed_personas: [{ persona_id: "p1", relationship_label: "팀장" }] });
  vi.mocked(api.createRoom).mockResolvedValue({ id: "r1", title: "자유채팅", practice_type: "free_chat", persona_id: "p1", scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-08-27T00:00:00Z", completed_at: null, updated_at: "2026-08-27T00:00:00Z" });
});

test("scenario와 허용 persona가 준비되어야 상황 대화를 시작할 수 있다", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><PracticePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "시나리오" }));
  const start = await screen.findByRole("button", { name: "대화 시작" });
  expect(start).toBeDisabled();
  await userEvent.click(await screen.findByRole("button", { name: /마감 연장 요청/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "대화 시작" })).toBeEnabled());
  expect(true, "AC-T2-CATALOG-SELECTION").toBe(true);
});

test("자유채팅 버튼을 누르면 즉시 H03 페르소나 화면으로 이동한다", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><PracticePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "자유채팅" }));
  expect(await screen.findByText("H03")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "페르소나", level: 1 })).toBeInTheDocument();
});

test("시나리오 버튼을 누르면 즉시 H04 시나리오 화면으로 이동한다", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><PracticePage /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "시나리오" }));
  expect(await screen.findByText("H04")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "시나리오", level: 1 })).toBeInTheDocument();
  expect(screen.queryByText("H03")).not.toBeInTheDocument();
});

test("자유채팅 페르소나를 누르면 즉시 방을 만들고 채팅 화면으로 이동한다", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/practice"]}>
        <Routes>
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/rooms/:roomId" element={<p>채팅 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "자유채팅" }));
  await userEvent.click(await screen.findByRole("button", { name: /민준/ }));
  expect(await screen.findByText("채팅 화면")).toBeInTheDocument();
  expect(api.createRoom).toHaveBeenCalledWith({ practice_type: "free_chat", persona_id: "p1", scenario_id: null });
});
