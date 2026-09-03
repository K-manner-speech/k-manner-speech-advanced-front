import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { ApiError } from "../../api/http";
import { api, waitForTerminal } from "../../api/service";
import { ConversationPage } from "./ConversationPage";
import { InterviewCompletePage } from "./InterviewCompletePage";

vi.mock("../../api/service", async () => ({
  api: { room: vi.fn(), messages: vi.fn(), sendMessage: vi.fn(), sendVoiceMessage: vi.fn(), completeInterview: vi.fn(), completeScenario: vi.fn(), continueAfterGoal: vi.fn(), interviewQuestions: vi.fn(), feedback: vi.fn(), retryFeedback: vi.fn(), audio: vi.fn(), retryTts: vi.fn(), repeatMessage: vi.fn(), result: vi.fn(), retryResult: vi.fn(), job: vi.fn() },
  waitForTerminal: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "대화", practice_type: "free_chat", persona_id: "p1", persona_name: "민준 팀장", scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:00Z", goal: "연습" });
  vi.mocked(api.messages).mockResolvedValue({ items: [], next_cursor: null });
});

test("AI 응답은 백엔드 45초 제한보다 긴 50초 동안 기다린다", async () => {
  vi.mocked(api.sendMessage).mockResolvedValue({
    message: { id: "message-1" },
    job: { job_id: "job-1", type: "conversation_text", status: "queued" },
  } as never);
  vi.mocked(waitForTerminal).mockResolvedValue({ status: "succeeded" });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.type(await screen.findByLabelText("내 답변"), "면접 답변입니다");
  await userEvent.click(screen.getByRole("button", { name: "보내기" }));

  expect(waitForTerminal).toHaveBeenCalledWith(expect.any(Function), "succeeded", 50_000);
});

test("대화 화면을 벗어나면 재생 중이던 음성을 멈춘다", async () => {
  const pause = vi.fn();
  vi.stubGlobal("Audio", function AudioMock() {
    return { play: vi.fn().mockResolvedValue(undefined), pause, removeAttribute: vi.fn(), load: vi.fn() };
  });
  vi.mocked(api.messages).mockResolvedValue({ items: [
    { id: "m1", room_id: "r1", sender_type: "persona", content: "안녕하세요", sequence_no: 2, input_mode: "text", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z", emotion: { status: "succeeded", label: "neutral", reasoning: null } },
  ], next_cursor: null });
  vi.mocked(api.audio).mockResolvedValue({ status: "ready", signed_url: "https://example.test/audio", expires_at: null, audio_type: "persona_tts", duration_ms: 1_000 });
  const user = userEvent.setup();
  const view = render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await user.click(await screen.findByRole("button", { name: "AI 음성 재생" }));
  expect(pause).not.toHaveBeenCalled();

  view.unmount();

  expect(pause).toHaveBeenCalled();
});

function goalAchievedRoom() {
  return { id: "r1", title: "학교 식당 위치 묻기", practice_type: "scenario" as const, persona_id: "p1", persona_name: "선배", scenario_id: "s1", status: "in_progress" as const, turn_count: 2, ended_reason: "goal_achieved", started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:00Z", goal: "존댓말로 식당 위치를 묻고 감사를 표현한다" };
}

test("전송 뒤 늦게 도착한 목표 달성을 폴링으로 받아온다", async () => {
  // 판정은 답장보다 몇 초 늦게 끝난다. 전송 직후 한 번만 읽으면 영영 못 받는다.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const inProgress = goalAchievedRoom();
  vi.mocked(api.room).mockResolvedValue({ ...inProgress, ended_reason: null });
  vi.mocked(api.sendMessage).mockResolvedValue({
    message: { id: "m9" }, job: { job_id: "job-9", type: "conversation_text", status: "queued" },
  } as never);
  vi.mocked(waitForTerminal).mockResolvedValue({ status: "succeeded" });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await user.type(await screen.findByLabelText("내 답변"), "알려주셔서 감사합니다");
  await user.click(screen.getByRole("button", { name: "보내기" }));
  expect(screen.queryByText("목표를 모두 달성했어요")).not.toBeInTheDocument();

  // 판정이 끝나 백엔드가 goal_achieved 를 세운 상황
  vi.mocked(api.room).mockResolvedValue(inProgress);
  await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });

  expect(await screen.findByText("목표를 모두 달성했어요")).toBeInTheDocument();
  vi.useRealTimers();
});

test("시나리오 상황 브리핑을 대화 화면에 보여준다", async () => {
  // 헤더의 goal 문단은 모바일 CSS 가 숨긴다. 브리핑은 전용 영역이어야 한다.
  const briefing = "점심시간인데 학생 식당이 어디인지 모른다. 선배에게 물어보자.";
  vi.mocked(api.room).mockResolvedValue({ ...goalAchievedRoom(), ended_reason: null, goal: briefing });
  vi.mocked(api.messages).mockResolvedValue({ items: [], next_cursor: null });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByText(briefing)).toBeInTheDocument();
  const panel = screen.getByText("이번 연습 상황").closest("details");
  expect(panel).toHaveAttribute("open");   // 첫 발화 전에는 펼쳐서 보여준다
});

test("면접 화면에는 상황 브리핑을 띄우지 않는다", async () => {
  vi.mocked(api.room).mockResolvedValue({
    ...goalAchievedRoom(), practice_type: "interview", ended_reason: null,
    interview_configuration_id: "cfg1", goal: "면접 목표",
  });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByText("면접 시뮬레이션")).toBeInTheDocument();
  expect(screen.queryByText("이번 연습 상황")).not.toBeInTheDocument();
  expect(screen.queryByText("면접 목표")).not.toBeInTheDocument();
});

test("목표를 달성하면 선택지를 띄우고 보내기만 잠근다", async () => {
  vi.mocked(api.room).mockResolvedValue(goalAchievedRoom());
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByText("목표를 모두 달성했어요")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "연습 종료" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "계속하기" })).toBeEnabled();

  // 쓰던 글이 날아가지 않도록 입력창은 열어둔다.
  const input = screen.getByLabelText("내 답변");
  expect(input).toBeEnabled();
  await userEvent.type(input, "조금 더 이야기하고 싶어요");
  expect(input).toHaveValue("조금 더 이야기하고 싶어요");

  expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "음성 입력 시작" })).toBeDisabled();
});

test("계속하기를 누르면 잠금이 풀린다", async () => {
  vi.mocked(api.room).mockResolvedValue(goalAchievedRoom());
  vi.mocked(api.continueAfterGoal).mockImplementation(async () => {
    vi.mocked(api.room).mockResolvedValue({ ...goalAchievedRoom(), ended_reason: null });
    return { ...goalAchievedRoom(), ended_reason: null } as never;
  });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.type(await screen.findByLabelText("내 답변"), "더 물어볼게요");
  await userEvent.click(screen.getByRole("button", { name: "계속하기" }));

  expect(api.continueAfterGoal).toHaveBeenCalledWith("r1");
  await waitFor(() => expect(screen.queryByText("목표를 모두 달성했어요")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "보내기" })).toBeEnabled();
});

test("연습 종료를 누르면 결과 화면으로 이동한다", async () => {
  vi.mocked(api.room).mockResolvedValue(goalAchievedRoom());
  vi.mocked(api.completeScenario).mockResolvedValue({ ...goalAchievedRoom(), status: "completed", ended_reason: "completed" } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes>
    <Route path="/rooms/:roomId" element={<ConversationPage />} />
    <Route path="/rooms/:roomId/result" element={<h1>결과 화면</h1>} />
  </Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.click(await screen.findByRole("button", { name: "연습 종료" }));

  expect(api.completeScenario).toHaveBeenCalledWith("r1");
  expect(await screen.findByRole("heading", { name: "결과 화면" })).toBeInTheDocument();
});

test("AI 메시지에는 음성 재생만 제공한다", async () => {
  const play = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("Audio", function AudioMock() { return { play, pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() }; });
  vi.mocked(api.messages).mockResolvedValue({ items: [
    { id: "u1", room_id: "r1", sender_type: "user", content: "일정을 바꿔 주세요", sequence_no: 1, input_mode: "text", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", emotion: { status: "succeeded", label: "happy", reasoning: null } },
    { id: "m1", room_id: "r1", sender_type: "persona", content: "안녕하세요", sequence_no: 2, input_mode: "text", delivery_status: "sent", reply_to_message_id: "u1", created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z", emotion: { status: "succeeded", label: "angry", reasoning: null } },
    { id: "s1", room_id: "r1", sender_type: "system", content: "시스템 안내", sequence_no: 3, input_mode: null, delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:02Z", updated_at: "2026-01-01T00:00:02Z", emotion: null },
  ], next_cursor: null });
  vi.mocked(api.audio).mockResolvedValue({ status: "ready", signed_url: "https://example.test/audio", expires_at: null, audio_type: "persona_tts", duration_ms: 1_000 });
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByRole("img", { name: "대화 상대의 불편함 표정" })).toHaveAttribute("src", "/personas/angry.png");
  expect(screen.getByText("민준 팀장")).toBeInTheDocument();
  expect(screen.getByText("시스템")).toBeInTheDocument();
  expect(screen.queryByText("AI 대화 상대")).not.toBeInTheDocument();
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

test("백엔드가 면접을 먼저 완료해도 대화창을 유지하고 종료 버튼으로 I11 화면에 이동한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, persona_name: "현우 면접관", scenario_id: null, status: "completed", turn_count: 3, ended_reason: "question_limit", started_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:08:42Z", updated_at: "2026-01-01T00:08:42Z", goal: "백엔드 개발자 면접" });
  vi.mocked(api.interviewQuestions).mockResolvedValue({ questions: [{ id: "q1", sequence: 1, text: "지원 동기를 말씀해 주세요", type: "motivation", source_document_ids: [] }] } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1?configuration=c1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /><Route path="/rooms/:roomId/interview-complete" element={<h1>I11 면접 종료 화면</h1>} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText("면접 시뮬레이션")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "음성 입력 시작" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "면접 종료" }));
  expect(await screen.findByRole("heading", { name: "I11 면접 종료 화면" })).toBeInTheDocument();
  expect(api.completeInterview).not.toHaveBeenCalled();
});

test("대화 목록에서 완료된 면접에 다시 들어오면 I11 종료 화면을 바로 보여준다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, persona_name: "현우 면접관", scenario_id: null, status: "completed", turn_count: 4, ended_reason: "completed", started_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:05:25Z", updated_at: "2026-01-01T00:05:25Z", goal: "백엔드 개발자 면접" });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[{ pathname: "/rooms/r1", state: { from: "/rooms" } }]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /><Route path="/rooms/:roomId/interview-complete" element={<h1>I11 면접 종료 화면</h1>} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByRole("heading", { name: "I11 면접 종료 화면" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "면접 종료" })).not.toBeInTheDocument();
});

test("마지막 면접관 응답은 자동 종료하지 않고 마이크 대신 수동 종료 버튼을 제공한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, persona_name: "현우 면접관", scenario_id: null, status: "in_progress", turn_count: 3, ended_reason: "awaiting_user_end", started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:08:42Z", goal: "백엔드 개발자 면접", current_interview_question_id: null } as never);
  vi.mocked(api.messages).mockResolvedValue({ items: [{ id: "closing", room_id: "r1", sender_type: "persona", content: "면접은 여기까지입니다. 수고하셨습니다.", sequence_no: 7, input_mode: null, delivery_status: "sent", reply_to_message_id: "u3", created_at: "2026-01-01T00:08:42Z", updated_at: "2026-01-01T00:08:42Z", emotion: null }], next_cursor: null } as never);
  vi.mocked(api.completeInterview).mockResolvedValue({ status: "completed" } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /><Route path="/rooms/:roomId/interview-complete" element={<h1>면접 완료 도착</h1>} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByText("면접은 여기까지입니다. 수고하셨습니다.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "음성 입력 시작" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "면접 종료" }));

  expect(api.completeInterview).toHaveBeenCalledWith("r1");
  expect(await screen.findByRole("heading", { name: "면접 완료 도착" })).toBeInTheDocument();
});

test("I11 독립 화면은 종료 정보와 종합 피드백 이동을 제공한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, persona_name: "현우 면접관", scenario_id: null, status: "completed", turn_count: 3, ended_reason: "completed", started_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:08:42Z", updated_at: "2026-01-01T00:08:42Z", goal: "백엔드 개발자 면접" });
  vi.mocked(api.result).mockResolvedValue({ id: "result-1" } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1/interview-complete"]}><Routes><Route path="/rooms/:roomId/interview-complete" element={<InterviewCompletePage />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("heading", { name: "면접이 종료되었습니다" })).toBeInTheDocument();
  expect(screen.getByText("답변 3개 저장 완료")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "종합 피드백 확인" })).toHaveAttribute("href", "/rooms/r1/result");
});

test("I11 화면은 처리 중인 결과를 자동 재조회하고 준비된 뒤 링크를 연다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, persona_name: "현우 면접관", scenario_id: null, status: "completed", turn_count: 3, ended_reason: "completed", started_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:08:42Z", updated_at: "2026-01-01T00:08:42Z", goal: "백엔드 개발자 면접" });
  vi.mocked(api.result)
    .mockRejectedValueOnce(new ApiError("RESULT_PROCESSING", "결과를 생성하고 있습니다.", true, 409))
    .mockResolvedValue({ id: "result-1" } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1/interview-complete"]}><Routes><Route path="/rooms/:roomId/interview-complete" element={<InterviewCompletePage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByRole("button", { name: "종합 피드백 정리 중…" })).toBeDisabled();
  expect(await screen.findByRole("link", { name: "종합 피드백 확인" }, { timeout: 2_500 })).toHaveAttribute("href", "/rooms/r1/result");
  expect(api.result).toHaveBeenCalledTimes(2);
});

test("I11 화면은 삭제되어 결과가 없는 완료 면접의 종합 피드백을 다시 생성한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, persona_name: "현우 면접관", scenario_id: null, status: "completed", turn_count: 9, ended_reason: "completed", started_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:27:51Z", updated_at: "2026-01-01T00:27:51Z", goal: "백엔드 개발자 면접" });
  vi.mocked(api.result)
    .mockRejectedValueOnce(new ApiError("RESULT_NOT_FOUND", "결과를 찾을 수 없습니다.", false, 404))
    .mockResolvedValue({ id: "result-restored" } as never);
  vi.mocked(api.retryResult).mockResolvedValue({ job: { job_id: "job-result" } } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1/interview-complete"]}><Routes><Route path="/rooms/:roomId/interview-complete" element={<InterviewCompletePage />} /></Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.click(await screen.findByRole("button", { name: "종합 피드백 생성" }));

  expect(api.retryResult).toHaveBeenCalledWith("r1");
  expect(waitForTerminal).toHaveBeenCalledWith(expect.any(Function), "succeeded", 190_000);
  expect(await screen.findByRole("link", { name: "종합 피드백 확인" })).toHaveAttribute("href", "/rooms/r1/result");
});

test("진행 중 면접은 질문을 면접관 말풍선으로 표시하고 마이크만 제공한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:08Z", goal: "백엔드 개발자 면접", current_interview_question_id: "q1" } as never);
  vi.mocked(api.interviewQuestions).mockResolvedValue({ questions: [{ id: "q1", sequence: 1, text: "지원 동기를 말씀해 주세요", type: "motivation", source_document_ids: [] }] } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1?configuration=c1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  const image = await screen.findByRole("img", { name: /면접 상대의/ });
  const question = screen.getByRole("group", { name: "현우 면접관의 질문" });
  expect(image.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(question).toHaveTextContent("지원 동기를 말씀해 주세요");
  expect(screen.getByRole("button", { name: "음성 입력 시작" })).toBeInTheDocument();
  expect(screen.queryByLabelText("내 답변")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "보내기" })).not.toBeInTheDocument();
  expect(screen.queryByText("AI 대화 상대")).not.toBeInTheDocument();
});

test("첫 질문과 맞춤 추가 질문, 고정 보충 확인, 다음 질문 전환을 모두 유지한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, scenario_id: null, status: "in_progress", turn_count: 1, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:08Z", goal: "백엔드 개발자 면접", interview_configuration_id: "c1", current_interview_question_id: "q1" } as never);
  vi.mocked(api.messages).mockResolvedValue({ items: [
    { id: "q1-message", room_id: "r1", sender_type: "persona", content: "파일 복구를 제한한 이유를 설명해 주세요.", sequence_no: 1, input_mode: null, delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", emotion: { status: "succeeded", label: "neutral", reasoning: null } },
    { id: "u1", room_id: "r1", sender_type: "user", content: "딱히 이유는 없습니다.", sequence_no: 2, input_mode: "voice", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z", emotion: null },
    { id: "followup", room_id: "r1", sender_type: "persona", content: "파일 복구 과정에서 가장 중요하게 고려한 점은 무엇인가요?", sequence_no: 3, input_mode: null, delivery_status: "sent", reply_to_message_id: "u1", created_at: "2026-01-01T00:00:02Z", updated_at: "2026-01-01T00:00:02Z", emotion: { status: "succeeded", label: "curious", reasoning: null } },
    { id: "u2", room_id: "r1", sender_type: "user", content: "잘 모르겠습니다.", sequence_no: 4, input_mode: "voice", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:03Z", updated_at: "2026-01-01T00:00:03Z", emotion: null },
    { id: "confirm", room_id: "r1", sender_type: "persona", content: "네, 말씀해 주신 내용 확인했습니다. 이 질문에 대해 더 보충하실 내용이 있으신가요?", sequence_no: 5, input_mode: null, delivery_status: "sent", reply_to_message_id: "u2", created_at: "2026-01-01T00:00:04Z", updated_at: "2026-01-01T00:00:04Z", emotion: { status: "succeeded", label: "curious", reasoning: null } },
    { id: "u3", room_id: "r1", sender_type: "user", content: "더 보충할 내용은 없습니다.", sequence_no: 6, input_mode: "voice", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:05Z", updated_at: "2026-01-01T00:00:05Z", emotion: null },
    { id: "transition", room_id: "r1", sender_type: "persona", content: "네, 답변 잘 들었습니다. 다음 질문입니다.", sequence_no: 7, input_mode: null, delivery_status: "sent", reply_to_message_id: "u3", created_at: "2026-01-01T00:00:06Z", updated_at: "2026-01-01T00:00:06Z", emotion: { status: "succeeded", label: "neutral", reasoning: null } },
  ], next_cursor: null } as never);
  vi.mocked(api.interviewQuestions).mockResolvedValue({ questions: [{ id: "q1", sequence: 1, text: "파일 복구를 제한한 이유를 설명해 주세요.", type: "technical", source_document_ids: [] }] } as never);

  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByText("파일 복구를 제한한 이유를 설명해 주세요.")).toBeInTheDocument();
  expect(screen.getByText("딱히 이유는 없습니다.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "피드백 보기" })).not.toBeInTheDocument();
  expect(screen.getByText("파일 복구 과정에서 가장 중요하게 고려한 점은 무엇인가요?")).toBeInTheDocument();
  expect(screen.getByText("네, 말씀해 주신 내용 확인했습니다. 이 질문에 대해 더 보충하실 내용이 있으신가요?")).toBeInTheDocument();
  expect(screen.getByText("네, 답변 잘 들었습니다. 다음 질문입니다.")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "현우 면접관의 질문" })).toBeInTheDocument();
  expect(screen.getAllByRole("group", { name: "현우 면접관의 답변" })).toHaveLength(3);
});

test("대화 목록에서 query 없이 면접방에 재입장해도 저장된 질문을 복원한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:08Z", goal: "백엔드 개발자 면접", interview_configuration_id: "c1", current_interview_question_id: "q1" } as never);
  vi.mocked(api.interviewQuestions).mockResolvedValue({ questions: [{ id: "q1", sequence: 1, text: "저장된 면접 질문입니다", type: "motivation", source_document_ids: [] }] } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("group", { name: "현우 면접관의 질문" })).toHaveTextContent("저장된 면접 질문입니다");
  expect(api.interviewQuestions).toHaveBeenCalledWith("c1");
});

test("대화 목록에서 들어온 방의 뒤로가기는 대화 목록으로 돌아간다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "다시 연 면접", practice_type: "interview", persona_id: null, scenario_id: null, status: "in_progress", turn_count: 0, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:08Z", goal: "면접", interview_configuration_id: "c1", current_interview_question_id: "q1" } as never);
  vi.mocked(api.interviewQuestions).mockResolvedValue({ questions: [{ id: "q1", sequence: 1, text: "질문", type: "motivation", source_document_ids: [] }] } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[{ pathname: "/rooms/r1", state: { from: "/rooms" } }]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /><Route path="/rooms" element={<h1>대화 목록 도착</h1>} /></Routes></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "뒤로 가기" }));
  expect(screen.getByRole("heading", { name: "대화 목록 도착" })).toBeInTheDocument();
  expect(screen.queryByText("면접 시뮬레이션")).not.toBeInTheDocument();
});

test("답변 횟수와 무관하게 서버가 지정한 현재 질문을 유지한다", async () => {
  vi.mocked(api.room).mockResolvedValue({ id: "r1", title: "모의 면접", practice_type: "interview", persona_id: null, scenario_id: null, status: "in_progress", turn_count: 2, ended_reason: null, started_at: "2026-01-01T00:00:00Z", completed_at: null, updated_at: "2026-01-01T00:00:08Z", goal: "백엔드 개발자 면접", interview_configuration_id: "c1", current_interview_question_id: "q1" } as never);
  vi.mocked(api.messages).mockResolvedValue({ items: [
    { id: "u1", room_id: "r1", sender_type: "user", content: "아직 답변 중입니다", sequence_no: 1, input_mode: "voice", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z", emotion: null },
    { id: "u2", room_id: "r1", sender_type: "user", content: "조금 더 설명하겠습니다", sequence_no: 2, input_mode: "voice", delivery_status: "sent", reply_to_message_id: null, created_at: "2026-01-01T00:00:02Z", updated_at: "2026-01-01T00:00:02Z", emotion: null },
  ], next_cursor: null });
  vi.mocked(api.interviewQuestions).mockResolvedValue({ questions: [
    { id: "q1", sequence: 1, text: "현재 질문을 계속 답해주세요", type: "motivation", source_document_ids: [] },
    { id: "q2", sequence: 2, text: "아직 나오면 안 되는 다음 질문", type: "experience", source_document_ids: [] },
  ] } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("group", { name: "현우 면접관의 질문" })).toHaveTextContent("현재 질문을 계속 답해주세요");
  expect(screen.queryByText("아직 나오면 안 되는 다음 질문")).not.toBeInTheDocument();
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

test("최종 실패한 피드백만 사용자가 다시 생성할 수 있다", async () => {
  vi.mocked(api.feedback)
    .mockResolvedValueOnce({
      status: "failed", overall_score: null, summary: null, scores: [], emotions: [],
      error: { code: "JOB_DEADLINE_EXCEEDED", retryable: false },
    })
    .mockResolvedValue({
      status: "processing", overall_score: null, summary: null, scores: [], emotions: [], error: null,
    });
  vi.mocked(api.retryFeedback).mockResolvedValue({
    target: { type: "turn_feedback", id: "feedback-1" },
    job: { job_id: "job-1", type: "turn_feedback", status: "queued" },
  } as never);
  renderFeedbackMessage("text");
  await userEvent.click(await screen.findByRole("button", { name: "피드백 보기" }));

  const retry = await screen.findByRole("button", { name: "피드백 다시 시도" });
  expect(api.retryFeedback).not.toHaveBeenCalled();
  await userEvent.click(retry);

  expect(api.retryFeedback).toHaveBeenCalledOnce();
  expect(api.retryFeedback).toHaveBeenCalledWith("u-feedback");
  expect(await screen.findByText("텍스트 입력 · 분석 중")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "피드백 다시 시도" })).not.toBeInTheDocument();
});

test("완료된 피드백에는 재시도 버튼이 없다", async () => {
  vi.mocked(api.feedback).mockResolvedValue(feedbackResponse);
  renderFeedbackMessage("text");
  await userEvent.click(await screen.findByRole("button", { name: "피드백 보기" }));

  expect(await screen.findByText("텍스트 입력 · 분석 완료")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "피드백 다시 시도" })).not.toBeInTheDocument();
});

test("최종 실패한 AI 음성만 다시 생성할 수 있다", async () => {
  vi.mocked(api.messages).mockResolvedValue({ items: [{
    id: "persona-audio", room_id: "r1", sender_type: "persona", content: "점심 같이 먹자", sequence_no: 2,
    input_mode: "text", delivery_status: "sent", reply_to_message_id: "user-1",
    created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z", emotion: null,
  }], next_cursor: null });
  vi.mocked(api.audio).mockResolvedValue({
    status: "failed", signed_url: null, expires_at: null, audio_type: "persona_tts", duration_ms: null,
  });
  vi.mocked(api.retryTts).mockResolvedValue({
    target: { type: "message_audio", id: "audio-1" },
    job: { job_id: "job-2", type: "tts_generation", status: "queued" },
  } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/rooms/r1"]}><Routes><Route path="/rooms/:roomId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "AI 음성 재생" }));

  const retry = await screen.findByRole("button", { name: "음성 다시 생성" });
  expect(api.retryTts).not.toHaveBeenCalled();
  await userEvent.click(retry);

  expect(api.retryTts).toHaveBeenCalledOnce();
  expect(api.retryTts).toHaveBeenCalledWith("persona-audio");
  expect(screen.queryByRole("button", { name: "음성 다시 생성" })).not.toBeInTheDocument();
});
