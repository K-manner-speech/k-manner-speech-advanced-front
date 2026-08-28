import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { api } from "../../api/service";
import { ConversationPage } from "./ConversationPage";

vi.mock("../../api/service", async () => ({
  api: { room: vi.fn(), messages: vi.fn(), sendMessage: vi.fn(), sendVoiceMessage: vi.fn(), interviewQuestions: vi.fn(), feedback: vi.fn(), audio: vi.fn(), retryTts: vi.fn(), repeatMessage: vi.fn() },
  waitForTerminal: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "대화", practice_type: "free_chat", persona_id: "p1", scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:00Z", goal: "연습" });
  vi.mocked(api.messages).mockResolvedValue({ items: [], next_cursor: null });
});

test("AI 메시지에는 음성 재생만 제공한다", async () => {
  const play = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("Audio", function AudioMock() { return { play }; });
  vi.mocked(api.messages).mockResolvedValue({ items: [
    { id: "u1", room_id: "r1", sender_type: "user", content: "일정을 바꿔 주세요", sequence_no: 1, input_mode: "text", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", emotion: { status: "succeeded", label: "happy", reasoning: null } },
    { id: "m1", room_id: "r1", sender_type: "persona", content: "안녕하세요", sequence_no: 2, input_mode: "text", delivery_status: "sent", reply_to_message_id: "u1", created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z", emotion: { status: "succeeded", label: "angry", reasoning: null } },
    { id: "s1", room_id: "r1", sender_type: "system", content: "시스템 안내", sequence_no: 3, input_mode: null, delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:02Z", updated_at: "2026-01-01T00:00:02Z", emotion: null },
  ], next_cursor: null });
  vi.mocked(api.audio).mockResolvedValue({ status: "ready", signed_url: "https://example.test/audio", expires_at: null, audio_type: "persona_tts" });
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByRole("img", { name: "대화 상대의 불편함 표정" })).toHaveAttribute("src", "/personas/angry.png");
  await user.click(await screen.findByRole("button", { name: "AI 음성 재생" }));
  expect(api.audio).toHaveBeenCalledWith("m1");
  expect(play).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "음성 생성 재시도" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "이 표현으로 반복 연습" })).not.toBeInTheDocument();
  const actions = screen.getByRole("button", { name: "AI 음성 재생" }).parentElement;
  expect(actions?.querySelectorAll("button")).toHaveLength(1);
  expect(api.repeatMessage).not.toHaveBeenCalled();
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

test("마이크로 인식한 답변을 voice 입력 방식으로 전송한다", async () => {
  class SpeechRecognitionMock {
    static latest: SpeechRecognitionMock | null = null;
    lang = "";
    continuous = false;
    interimResults = false;
    start = vi.fn();
    stop = vi.fn();
    onresult: ((event: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    constructor() { SpeechRecognitionMock.latest = this; }
  }
  class MediaRecorderMock {
    static isTypeSupported = () => true;
    state: RecordingState = "inactive";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start = vi.fn(() => { this.state = "recording"; });
    stop = vi.fn(() => {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
      this.onstop?.();
    });
  }
  const stopTrack = vi.fn();
  Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: SpeechRecognitionMock });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  vi.stubGlobal("MediaRecorder", MediaRecorderMock);
  vi.mocked(api.sendVoiceMessage).mockResolvedValue({ message: { id: "voice-message" }, job: { job_id: "voice-job", type: "conversation_text", status: "queued" } } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.click(await screen.findByRole("button", { name: "음성 입력 시작" }));
  expect(SpeechRecognitionMock.latest?.start).toHaveBeenCalled();
  act(() => SpeechRecognitionMock.latest?.onresult?.({ results: [[{ transcript: "일정을 변경해 주세요" }]] }));
  expect(screen.getByLabelText("내 답변")).toHaveValue("일정을 변경해 주세요");
  await userEvent.click(screen.getByRole("button", { name: "음성 입력 중지" }));
  await userEvent.click(screen.getByRole("button", { name: "보내기" }));
  expect(api.sendVoiceMessage).toHaveBeenCalledWith("r1", "일정을 변경해 주세요", expect.any(Blob), undefined);
  expect(api.sendMessage).not.toHaveBeenCalled();
  Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
});

test("음성 인식 미지원 브라우저에서는 안내하고 전송하지 않는다", async () => {
  Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.click(await screen.findByRole("button", { name: "음성 입력 시작" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("이 브라우저에서는 음성 입력을 지원하지 않습니다");
  expect(api.sendMessage).not.toHaveBeenCalled();
  expect(api.sendVoiceMessage).not.toHaveBeenCalled();
});

test("지원하는 녹음 형식이 없으면 스트림을 닫고 안내한다", async () => {
  class SpeechRecognitionMock {}
  class UnsupportedMediaRecorderMock {
    static isTypeSupported = () => false;
  }
  const stopTrack = vi.fn();
  Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: SpeechRecognitionMock });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  vi.stubGlobal("MediaRecorder", UnsupportedMediaRecorderMock);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.click(await screen.findByRole("button", { name: "음성 입력 시작" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("지원하는 음성 녹음 형식을 찾지 못했습니다");
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(api.sendVoiceMessage).not.toHaveBeenCalled();
});

const feedbackResponse = {
  status: "ready" as const,
  overall_score: 88,
  summary: "상황에 맞는 정중한 답변이에요.",
  scores: [
    { category: "honorifics" as const, score: 22, max_score: 25 as const, strength: "높임말을 알맞게 사용했어요.", suggestion: "끝맺음을 더 부드럽게 해 보세요.", original_text: null, recommended_text: "일정을 변경해 주실 수 있을까요?" },
    { category: "courtesy" as const, score: 23, max_score: 25 as const, strength: "배려가 느껴져요.", suggestion: null, original_text: null, recommended_text: null },
    { category: "context_fit" as const, score: 21, max_score: 25 as const, strength: "상황에 잘 맞아요.", suggestion: null, original_text: null, recommended_text: null },
    { category: "naturalness" as const, score: 22, max_score: 25 as const, strength: "자연스러워요.", suggestion: null, original_text: null, recommended_text: null },
  ],
  emotions: [],
  error: null,
};

function renderFeedbackMessage(inputMode: "text" | "voice") {
  vi.mocked(api.messages).mockResolvedValue({ items: [{
    id: "u-feedback", room_id: "r1", sender_type: "user", content: "일정을 바꿔 주세요", sequence_no: 1,
    input_mode: inputMode, delivery_status: "sent", reply_to_message_id: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", emotion: null,
  }], next_cursor: null });
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

test("텍스트 답변 피드백은 T04 구성으로 표시한다", async () => {
  vi.mocked(api.feedback).mockResolvedValue(feedbackResponse);
  renderFeedbackMessage("text");
  await userEvent.click(await screen.findByRole("button", { name: "피드백 보기" }));

  expect(await screen.findByRole("dialog", { name: "답변 피드백" })).toBeInTheDocument();
  expect(screen.getByText("텍스트 입력 · 분석 완료")).toBeInTheDocument();
  expect(screen.getAllByText("높임법")).not.toHaveLength(0);
  expect(screen.getAllByText("예의와 배려")).not.toHaveLength(0);
  expect(screen.queryByText("감정 분석")).not.toBeInTheDocument();
  expect(screen.queryByText("상대가 느끼는 인상")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "피드백 닫기" })).toBeInTheDocument();
});

test("음성 답변 피드백은 C07 구성으로 감정과 인상을 표시한다", async () => {
  vi.mocked(api.feedback).mockResolvedValue({ ...feedbackResponse, emotions: [
    { label: "neutral", percentage: 72, sort_order: 0, source: "voice", evidence: "안정적인 속도", impression: "차분하게 들려요" },
    { label: "happy", percentage: 18, sort_order: 1, source: "voice", evidence: null, impression: "친절한 말투예요" },
  ] });
  renderFeedbackMessage("voice");
  await userEvent.click(await screen.findByRole("button", { name: "피드백 보기" }));

  expect(await screen.findByText("마이크 입력 · 분석 완료")).toBeInTheDocument();
  expect(screen.getByText("감정 분석")).toBeInTheDocument();
  expect(screen.getByText("72%")).toBeInTheDocument();
  expect(screen.getByText("상대가 느끼는 인상")).toBeInTheDocument();
  expect(screen.getByText("차분하게 들려요")).toBeInTheDocument();
  expect(screen.queryByText("context_fit")).not.toBeInTheDocument();
});

test("처리 중인 피드백은 완료될 때까지 자동으로 다시 조회한다", async () => {
  vi.mocked(api.feedback)
    .mockResolvedValueOnce({ status: "processing", overall_score: null, summary: null, scores: [], emotions: [], error: null })
    .mockResolvedValue(feedbackResponse);
  renderFeedbackMessage("text");
  await userEvent.click(await screen.findByRole("button", { name: "피드백 보기" }));

  expect(await screen.findByText("텍스트 입력 · 분석 중")).toBeInTheDocument();
  expect(screen.getByText("피드백을 분석하고 있어요")).toBeInTheDocument();
  expect(screen.queryByLabelText("종합 점수")).not.toBeInTheDocument();
  expect(await screen.findByText("텍스트 입력 · 분석 완료", {}, { timeout: 2_500 })).toBeInTheDocument();
  expect(api.feedback).toHaveBeenCalledTimes(2);
});
