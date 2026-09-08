import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { api } from "../../api/service";
import { HomePage } from "./HomePage";

vi.mock("../../api/service", () => ({
  api: { home: vi.fn(), attend: vi.fn() },
}));

function summary(overrides: Record<string, unknown> = {}) {
  return {
    streak: {
      attended_today: false,
      streak_days: 3,
      recent_days: 3,
      goal_days: 7,
      today: "2026-09-08",
      ...overrides,
    },
    recommendation: {
      scenario_id: "s1",
      title: "학교 선배에게 먼저 말 걸기",
      goal: "길 물어보기",
      difficulty: "easy",
      estimated_minutes: 3,
      persona_id: "p1",
      persona_name: "도윤",
      relationship_label: "학교 선배",
      opening_message: "선배님, 혹시 도서관 가는 길을 알려주실 수 있나요?",
      completed_before: false,
    },
  };
}

function renderHome() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

test("피드백 모아보기는 R00 결과 목록 경로로 연결된다", async () => {
  vi.mocked(api.home).mockResolvedValue(summary() as never);
  renderHome();
  expect(await screen.findByRole("link", { name: "보기 →" })).toHaveAttribute("href", "/results");
});

test("연속 학습과 최근 7일 진행을 함께 보여 준다", async () => {
  vi.mocked(api.home).mockResolvedValue(summary() as never);
  renderHome();

  expect(await screen.findByRole("heading", { name: "3일 연속 학습 중" })).toBeInTheDocument();
  expect(screen.getByText("7일 목표 · 3/7")).toBeInTheDocument();
  // 색만으로 진행을 알리지 않는다.
  expect(screen.getByRole("img", { name: "최근 7일 중 3일 출석" })).toBeInTheDocument();
});

test("출석하면 버튼 대신 완료 상태를 보여 준다", async () => {
  vi.mocked(api.home).mockResolvedValue(summary() as never);
  vi.mocked(api.attend).mockResolvedValue(
    summary({ attended_today: true, streak_days: 4, recent_days: 4 }) as never,
  );
  renderHome();

  await userEvent.click(await screen.findByRole("button", { name: "출석하기" }));

  await waitFor(() => expect(screen.getByText("✓ 오늘 출석 완료")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "출석하기" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "4일 연속 학습 중" })).toBeInTheDocument();
});

test("추천이 없으면 빈 카드 대신 이유와 다음 행동을 보여 준다", async () => {
  vi.mocked(api.home).mockResolvedValue({ ...summary(), recommendation: null } as never);
  renderHome();

  expect(await screen.findByText(/추천할 연습을 고르지 못했어요/)).toBeInTheDocument();
});
