import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { api } from "../../api/service";
import { ConversationPage } from "./ConversationPage";

vi.mock("../../api/service", async () => ({
  api: { room: vi.fn(), messages: vi.fn(), sendMessage: vi.fn(), interviewQuestions: vi.fn(), feedback: vi.fn(), audio: vi.fn(), retryTts: vi.fn(), repeatMessage: vi.fn() },
  waitForTerminal: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "대화", practice_type: "free_chat", persona_id: "p1", scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:00Z", goal: "연습" });
  vi.mocked(api.messages).mockResolvedValue({ items: [], next_cursor: null });
});

test("AI 메시지에서 음성 재생, TTS 재시도, 반복 연습을 실행한다", async () => {
  const play = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("Audio", function AudioMock() { return { play }; });
  vi.mocked(api.messages).mockResolvedValue({ items: [
    { id: "u1", room_id: "r1", sender_type: "user", content: "일정을 바꿔 주세요", sequence_no: 1, input_mode: "text", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", emotion: { status: "succeeded", label: "happy", reasoning: null } },
    { id: "m1", room_id: "r1", sender_type: "persona", content: "안녕하세요", sequence_no: 2, input_mode: "text", delivery_status: "sent", reply_to_message_id: "u1", created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z", emotion: { status: "succeeded", label: "angry", reasoning: null } },
    { id: "s1", room_id: "r1", sender_type: "system", content: "시스템 안내", sequence_no: 3, input_mode: null, delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:02Z", updated_at: "2026-01-01T00:00:02Z", emotion: null },
  ], next_cursor: null });
  vi.mocked(api.audio).mockResolvedValue({ status: "ready", signed_url: "https://example.test/audio", expires_at: null, audio_type: "persona_tts" });
  vi.mocked(api.retryTts).mockResolvedValue({ target: { type: "message_audio", id: "a1" }, job: { job_id: "j1", type: "tts_generation", status: "queued" } });
  vi.mocked(api.repeatMessage).mockResolvedValue({ message: { id: "m2" }, job: { job_id: "j2", type: "conversation_text", status: "queued" } } as never);
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByRole("img", { name: "대화 상대의 불편함 표정" })).toHaveAttribute("src", "/personas/angry.png");
  await user.click(await screen.findByRole("button", { name: "AI 음성 재생" }));
  expect(api.audio).toHaveBeenCalledWith("m1");
  expect(play).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "음성 생성 재시도" }));
  expect(api.retryTts).toHaveBeenCalledWith("m1");
  await user.click(screen.getByRole("button", { name: "이 표현으로 반복 연습" }));
  expect(api.repeatMessage).toHaveBeenCalledWith("m1", "안녕하세요");
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
