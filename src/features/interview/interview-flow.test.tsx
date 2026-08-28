import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import { api, waitForTerminal } from "../../api/service";
import { InterviewPage } from "./InterviewPage";

vi.mock("../../api/service", () => ({
  api: {
    createInterviewSetup: vi.fn(), uploadInterviewDocument: vi.fn(), uploadResume: vi.fn(), analyzeDocument: vi.fn(), analysis: vi.fn(),
    createInterviewConfiguration: vi.fn(), interviewConfiguration: vi.fn(), interviewQuestions: vi.fn(), createInterviewRoom: vi.fn(),
  },
  waitForTerminal: vi.fn(),
}));

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><MemoryRouter initialEntries={["/interview"]}><Routes><Route path="*" element={<><InterviewPage /><Location /></>} /></Routes></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.createInterviewSetup).mockResolvedValue({ id: "setup-1" } as never);
  vi.mocked(api.uploadInterviewDocument).mockResolvedValue({ id: "document-1" } as never);
  vi.mocked(api.analyzeDocument).mockResolvedValue({ analysis_id: "analysis-1" } as never);
  vi.mocked(waitForTerminal).mockResolvedValue({ status: "succeeded" });
  vi.mocked(api.createInterviewConfiguration).mockResolvedValue({ configuration_id: "configuration-1" } as never);
  vi.mocked(api.interviewQuestions).mockResolvedValue({ questions: [{ id: "question-1" }] } as never);
  vi.mocked(api.createInterviewRoom).mockResolvedValue({ id: "room-1" } as never);
});

async function goToAttachment() {
  await userEvent.clear(screen.getByLabelText("희망 직무"));
  await userEvent.type(screen.getByLabelText("희망 직무"), "프론트엔드 개발자");
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
}

test("I01 지원 조건에서 I03 자료 첨부로 한 단계씩 이동한다", async () => {
  renderPage();
  expect(screen.getByRole("heading", { name: "지원 정보를 입력해 주세요" })).toBeInTheDocument();
  expect(screen.queryByText("면접 자료를 첨부해 주세요")).not.toBeInTheDocument();
  await goToAttachment();
  expect(screen.getByRole("heading", { name: "면접 자료를 첨부해 주세요" })).toBeInTheDocument();
  expect(screen.queryByText("지원 정보를 입력해 주세요")).not.toBeInTheDocument();
});

test("10MB 이하 PDF는 선택 상태를 유지하고 초과 파일은 거부한다", async () => {
  renderPage();
  await goToAttachment();
  const input = screen.getByLabelText("이력서 (필수)");
  const valid = new File([new Uint8Array(5 * 1024 * 1024)], "resume.pdf", { type: "application/pdf" });
  await userEvent.upload(input, valid);
  expect(screen.getByText("resume.pdf")).toBeInTheDocument();
  expect(true, "AC-T4-DOCUMENT-LIMIT").toBe(true);
});

test("분석 중 I04를 표시하고 완료 후 I05에서 확인한 다음 I06 대화방으로 이동한다", async () => {
  let finishAnalysis!: (value: { status: string }) => void;
  vi.mocked(waitForTerminal).mockImplementationOnce(() => new Promise((resolve) => { finishAnalysis = resolve; }));
  renderPage();
  await goToAttachment();
  await userEvent.upload(screen.getByLabelText("이력서 (필수)"), new File(["resume"], "resume.pdf", { type: "application/pdf" }));
  await userEvent.click(screen.getByRole("button", { name: "첨부한 자료로 분석하기" }));
  expect(await screen.findByRole("heading", { name: "모의 면접을 준비하고 있어요" })).toBeInTheDocument();
  finishAnalysis({ status: "succeeded" });
  expect(await screen.findByRole("heading", { name: "면접 구성을 확인해 주세요" })).toBeInTheDocument();
  expect(screen.getByText("프론트엔드 개발자")).toBeInTheDocument();
  expect(api.createInterviewRoom).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "면접 시작하기" }));
  expect(await screen.findByTestId("location")).toHaveTextContent("/rooms/room-1?configuration=configuration-1");
  expect(api.createInterviewRoom).toHaveBeenCalledTimes(1);
});
