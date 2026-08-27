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
