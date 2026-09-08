import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { api } from "../../api/service";
import { ResultListPage } from "./ResultListPage";
import { ResultPage } from "./ResultPage";

vi.mock("../../api/service", () => ({
  api: { results: vi.fn(), result: vi.fn(), resultById: vi.fn(), retryResult: vi.fn(), deleteResult: vi.fn(), job: vi.fn() },
  waitForTerminal: vi.fn().mockResolvedValue({ status: "succeeded" }),
}));

const snapshot = { id: "res1", room_id: "room1", attempt_no: 1, practice_type: "interview" as const, display_title: "면접 자기소개", status: "succeeded" as const, failure_code: null, missing_categories: [], created_at: "2026-08-27T00:00:00Z", items: [], scores: [], source_refs: [], overall_score: 80, summary: "좋은 연습", interview_evaluation: { status: "succeeded" as const, overall_score: 84, summary: "질문의 의도를 빠르게 이해했어요.", missing_categories: [], scores: [
  { category: "specificity_evidence" as const, score: 18, max_score: 20 as const, strength: "구체적인 근거를 제시했어요.", suggestion: "성과를 수치로 덧붙여 보세요.", evidence: "사용자 조사 결과를 바탕으로 개선했습니다." },
] } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.results).mockResolvedValue({ items: [snapshot], next_cursor: null });
  vi.mocked(api.result).mockResolvedValue(snapshot);
  vi.mocked(api.resultById).mockResolvedValue(snapshot);
  vi.mocked(api.deleteResult).mockResolvedValue(undefined as never);
});

function renderAt(path: string, element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><Routes><Route path={path.includes("rooms") ? "/rooms/:roomId/result" : path === "/results" ? "/results" : "/results/:resultId"} element={element} /></Routes></MemoryRouter></QueryClientProvider>);
}

test("결과 목록은 저장된 결과 ID 상세 경로를 제공한다", async () => {
  renderAt("/results", <ResultListPage />);
  expect(await screen.findByRole("heading", { name: "피드백 목록" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /피드백 확인/ })).toHaveAttribute("href", "/results/res1");
  expect(api.results).toHaveBeenCalledWith(undefined, 20);
  expect(screen.getByRole("heading", { name: "면접 자기소개" })).toBeInTheDocument();
});

test("생성 시간을 초과한 면접 결과는 원인과 재시도를 보여준다", async () => {
  const failed = { ...snapshot, status: "failed" as const, failure_code: "JOB_DEADLINE_EXCEEDED", overall_score: null, interview_evaluation: { status: "failed" as const, overall_score: null, summary: null, scores: [], missing_categories: ["question_understanding_fit" as const] } };
  vi.mocked(api.resultById).mockResolvedValue(failed);
  renderAt("/results/res1", <ResultPage source="result" />);
  expect(await screen.findByText(/시간이 제한을 초과/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "피드백 다시 생성" })).toBeInTheDocument();
});

test("면접 결과는 R21에서 R25·R27 목록과 R22·R23 상세로 이동한다", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/results/res1"]}><Routes>
    <Route path="/results/:resultId" element={<ResultPage source="result" />} />
    <Route path="/results/:resultId/strengths" element={<ResultPage source="result" view="strengths" />} />
    <Route path="/results/:resultId/strengths/:key" element={<ResultPage source="result" view="strength-detail" />} />
    <Route path="/results/:resultId/improvements" element={<ResultPage source="result" view="improvements" />} />
    <Route path="/results/:resultId/improvements/:key" element={<ResultPage source="result" view="improvement-detail" />} />
  </Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("heading", { name: "면접 총평" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: "이번 면접에서 잘한 점" }));
  expect(await screen.findByRole("heading", { name: "이번 면접에서 잘한 점" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: /구체성·근거/ }));
  expect(await screen.findByRole("heading", { name: "잘한 점 상세" })).toBeInTheDocument();
  expect(screen.getByText("사용자 조사 결과를 바탕으로 개선했습니다.")).toBeInTheDocument();
});

test("강점이 없으면 사실을 명확히 안내하고 보완 항목 5개를 모두 보여준다", async () => {
  const categories = [
    "question_understanding_fit",
    "answer_structure",
    "specificity_evidence",
    "job_fit_problem_solving",
    "delivery_attitude",
  ] as const;
  const noStrengths = {
    ...snapshot,
    interview_evaluation: {
      ...snapshot.interview_evaluation,
      overall_score: 40,
      scores: categories.map((category) => ({
        category,
        score: 8,
        max_score: 20 as const,
        strength: null,
        suggestion: `${labelsForTest[category]} 보완 제안`,
        evidence: `${labelsForTest[category]} 근거`,
      })),
    },
  };
  vi.mocked(api.resultById).mockResolvedValue(noStrengths);

  renderAt("/results/res1", <ResultPage source="result" />);

  expect(await screen.findByText("이번 면접에서는 뚜렷하게 확인된 강점이 없어요.")).toBeInTheDocument();
  for (const label of Object.values(labelsForTest)) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});

test("방 경로와 결과 ID 경로가 서로 다른 조회 API를 사용한다", async () => {
  // 면접 총평은 면접 평가의 요약을 보여 준다.
  const roomView = renderAt("/rooms/r1/result", <ResultPage source="room" />);
  expect(await screen.findByText("질문의 의도를 빠르게 이해했어요.")).toBeInTheDocument();
  expect(api.result).toHaveBeenCalledWith("r1");
  roomView.unmount();
  renderAt("/results/res1", <ResultPage source="result" />);
  expect(await screen.findByText("질문의 의도를 빠르게 이해했어요.")).toBeInTheDocument();
  expect(api.resultById).toHaveBeenCalledWith("res1");
});

test("저장 결과 삭제를 취소하면 API를 호출하지 않는다", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  renderAt("/results/res1", <ResultPage source="result" />);
  await userEvent.click(await screen.findByRole("button", { name: "결과 삭제" }));
  expect(api.deleteResult).not.toHaveBeenCalled();
});

test("면접 결과 삭제 성공 시 목록으로 이동한다", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/results/res1"]}><Routes>
    <Route path="/results/:resultId" element={<ResultPage source="result" />} />
    <Route path="/results" element={<h1>결과 목록 화면</h1>} />
  </Routes></MemoryRouter></QueryClientProvider>);

  await userEvent.click(await screen.findByRole("button", { name: "결과 삭제" }));
  expect(api.deleteResult).toHaveBeenCalledWith("res1");
  expect(await screen.findByRole("heading", { name: "결과 목록 화면" })).toBeInTheDocument();
});

test("면접 결과 삭제 실패를 화면에 표시한다", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(api.deleteResult).mockRejectedValue(new Error("결과를 삭제하지 못했습니다."));
  renderAt("/results/res1", <ResultPage source="result" />);

  await userEvent.click(await screen.findByRole("button", { name: "결과 삭제" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("결과를 삭제하지 못했습니다.");
});

const labelsForTest = {
  question_understanding_fit: "질문 이해·적합성",
  answer_structure: "답변 구조",
  specificity_evidence: "구체성·근거",
  job_fit_problem_solving: "직무 적합성·문제 해결력",
  delivery_attitude: "전달력·태도",
} as const;

const generalSnapshot = {
  ...snapshot,
  practice_type: "scenario" as const,
  display_title: "학교 식당 위치 묻기",
  overall_score: 75,
  summary: "핵심 목적은 달성했지만 첫 인사에서 존댓말이 아니었습니다.",
  interview_evaluation: null,
  scores: [
    { category: "honorifics", score: 15, max_score: 25, strength: null, suggestion: "존댓말을 지켜 보세요.", evidence: "안녕?" },
    { category: "courtesy", score: 20, max_score: 25, strength: "감사 인사를 남겼어요.", suggestion: null, evidence: "감사합니다" },
  ],
  items: [
    { item_type: "strength", category: "context_fit", title: "학생 식당 위치를 구체적으로 질문함", original_expression: "식당이 어딨어요 선배?", recommended_expression: null, explanation: "구체적인 안내를 받았습니다.", evidence: "“식당이 어딨어요 선배?”", source_document_id: null, order: 1 },
    { item_type: "improvement", category: "honorifics", title: "첫 인사의 존댓말과 호칭을 일관되게 사용하기", original_expression: "안녕?", recommended_expression: "안녕하세요, 선배님!", explanation: "첫 인사는 반말형이었습니다.", evidence: "“안녕?”", source_document_id: null, order: 2 },
  ],
};

function renderGeneralRoutes(entry: string) {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/results/:resultId" element={<ResultPage source="result" />} />
    <Route path="/results/:resultId/strengths" element={<ResultPage source="result" view="strengths" />} />
    <Route path="/results/:resultId/strengths/:key" element={<ResultPage source="result" view="strength-detail" />} />
    <Route path="/results/:resultId/improvements" element={<ResultPage source="result" view="improvements" />} />
    <Route path="/results/:resultId/improvements/:key" element={<ResultPage source="result" view="improvement-detail" />} />
    <Route path="/results/:resultId/scores" element={<ResultPage source="result" view="scores" />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}

test("결과 요약은 항목별 점수와 잘한 점·개선할 점을 미리 보여 준다", async () => {
  vi.mocked(api.resultById).mockResolvedValue(generalSnapshot as never);
  renderGeneralRoutes("/results/res1");

  expect(await screen.findByText("종합 점수")).toBeInTheDocument();
  expect(screen.getByText("75")).toBeInTheDocument();
  // 누르지 않아도 무엇을 잘했고 무엇을 고칠지 읽을 수 있어야 한다.
  expect(screen.getByText("학생 식당 위치를 구체적으로 질문함")).toBeInTheDocument();
  expect(screen.getByText("첫 인사의 존댓말과 호칭을 일관되게 사용하기")).toBeInTheDocument();
  expect(screen.getByText("높임법")).toBeInTheDocument();
});

test("항목별 점수를 누르면 R02 상세 평가로 간다", async () => {
  vi.mocked(api.resultById).mockResolvedValue(generalSnapshot as never);
  renderGeneralRoutes("/results/res1");

  await userEvent.click(await screen.findByRole("link", { name: "항목별 점수" }));

  expect(await screen.findByRole("heading", { name: "항목별 상세 평가" })).toBeInTheDocument();
  expect(screen.getByText("15/25")).toBeInTheDocument();
  expect(screen.getByText("존댓말을 지켜 보세요.")).toBeInTheDocument();
});

test("잘한 점과 개선할 점은 각각 한 화면에 표현을 모아 보여 준다", async () => {
  vi.mocked(api.resultById).mockResolvedValue(generalSnapshot as never);
  renderGeneralRoutes("/results/res1");

  await userEvent.click(await screen.findByRole("link", { name: "개선할 점" }));

  expect(await screen.findByRole("heading", { name: "개선할 표현" })).toBeInTheDocument();
  expect(screen.getByText("안녕?")).toBeInTheDocument();
  expect(screen.getByText("안녕하세요, 선배님!")).toBeInTheDocument();
});

test("면접 결과도 종합 점수를 보여 준다", async () => {
  vi.mocked(api.resultById).mockResolvedValue(snapshot as never);
  renderAt("/results/res1", <ResultPage source="result" />);

  expect(await screen.findByText("종합 점수")).toBeInTheDocument();
  // 면접 평가가 자기 점수를 갖고 있으면 결과의 전체 점수보다 그 값을 쓴다.
  expect(screen.getByText("84")).toBeInTheDocument();
});

test("점수를 매기지 못한 면접 결과는 빈 자리 대신 없음을 표시한다", async () => {
  vi.mocked(api.resultById).mockResolvedValue({
    ...snapshot,
    overall_score: null,
    interview_evaluation: { ...snapshot.interview_evaluation, overall_score: null },
  } as never);
  renderAt("/results/res1", <ResultPage source="result" />);

  expect(await screen.findByText("종합 점수")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
});
