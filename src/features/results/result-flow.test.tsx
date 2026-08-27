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

const snapshot = { id: "res1", attempt_no: 1, status: "succeeded" as const, missing_categories: [], created_at: "2026-08-27T00:00:00Z", items: [], source_refs: [], overall_score: 80, summary: "좋은 연습" };

beforeEach(() => {
  vi.mocked(api.results).mockResolvedValue({ items: [snapshot], next_cursor: null });
  vi.mocked(api.result).mockResolvedValue(snapshot);
  vi.mocked(api.resultById).mockResolvedValue(snapshot);
});

function renderAt(path: string, element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><Routes><Route path={path.includes("rooms") ? "/rooms/:roomId/result" : path === "/results" ? "/results" : "/results/:resultId"} element={element} /></Routes></MemoryRouter></QueryClientProvider>);
}

test("결과 목록은 저장된 결과 ID 상세 경로를 제공한다", async () => {
  renderAt("/results", <ResultListPage />);
  expect(await screen.findByText("좋은 연습 결과를 다시 확인하세요")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "결과 상세 보기" })).toHaveAttribute("href", "/results/res1");
  expect(api.results).toHaveBeenCalledWith(undefined, 20);
});

test("방 경로와 결과 ID 경로가 서로 다른 조회 API를 사용한다", async () => {
  const roomView = renderAt("/rooms/r1/result", <ResultPage source="room" />);
  expect(await screen.findByText("좋은 연습")).toBeInTheDocument();
  expect(api.result).toHaveBeenCalledWith("r1");
  roomView.unmount();
  renderAt("/results/res1", <ResultPage source="result" />);
  expect(await screen.findByText("좋은 연습")).toBeInTheDocument();
  expect(api.resultById).toHaveBeenCalledWith("res1");
});

test("저장 결과 삭제를 취소하면 API를 호출하지 않는다", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  renderAt("/results/res1", <ResultPage source="result" />);
  await userEvent.click(await screen.findByRole("button", { name: "결과 삭제" }));
  expect(api.deleteResult).not.toHaveBeenCalled();
});
