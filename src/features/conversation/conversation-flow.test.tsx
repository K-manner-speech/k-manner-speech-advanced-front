import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { api } from "../../api/service";
import { ConversationPage } from "./ConversationPage";

vi.mock("../../api/service", async () => ({
  api: { room: vi.fn(), messages: vi.fn(), sendMessage: vi.fn(), interviewQuestions: vi.fn(), feedback: vi.fn() },
  waitForTerminal: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "대화", practice_type: "free_chat", persona_id: "p1", scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:00Z", goal: "연습" });
  vi.mocked(api.messages).mockResolvedValue({ items: [], next_cursor: null });
});

test("공백 메시지는 submit 이벤트가 발생해도 API로 전송하지 않는다", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  const input = await screen.findByLabelText("내 답변");
  await userEvent.type(input, "   ");
  fireEvent.submit(input.closest("form")!);
  expect(api.sendMessage).not.toHaveBeenCalled();
  expect(await screen.findByText(/공백 메시지는 보낼 수 없습니다/)).toBeInTheDocument();
  expect(true, "AC-T3-NO-BLANK-MESSAGE").toBe(true);
});
