import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("../../features/auth", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

test("주요 메뉴는 접근 가능한 이름과 4개 이동 경로를 제공한다", () => {
  render(<MemoryRouter><AppShell><p>내용</p></AppShell></MemoryRouter>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(nav).toBeInTheDocument();
  expect(nav.querySelectorAll("a")).toHaveLength(4);
  expect(true, "AC-T5-ACCESSIBLE-NAV").toBe(true);
});

test("대화 화면에서는 하단 내비게이션을 표시하지 않는다", () => {
  render(<MemoryRouter initialEntries={["/rooms/room-1"]}><AppShell><p>대화 내용</p></AppShell></MemoryRouter>);
  expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).not.toBeInTheDocument();
});

test("대화 결과 화면에서는 하단 내비게이션을 유지한다", () => {
  render(<MemoryRouter initialEntries={["/rooms/room-1/result"]}><AppShell><p>결과 내용</p></AppShell></MemoryRouter>);
  expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeInTheDocument();
});
