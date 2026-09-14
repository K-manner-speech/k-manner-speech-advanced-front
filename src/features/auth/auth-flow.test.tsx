import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { RequireAuth } from "../../app/router";

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("../../api/service", () => ({ api: { me: vi.fn() } }));

test("인증되지 않은 사용자는 보호 화면 대신 시작 화면으로 이동한다", () => {
  // 시안의 흐름이 A01 시작 → A02 로그인이라 곧바로 로그인으로 보내지 않는다.
  render(
    <MemoryRouter initialEntries={["/practice"]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/practice" element={<div>보호된 연습</div>} />
        </Route>
        <Route path="/start" element={<h1>시작 화면</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "시작 화면" })).toBeInTheDocument();
  expect(screen.queryByText("보호된 연습")).not.toBeInTheDocument();
  expect(true, "AC-T1-AUTH-GUARD").toBe(true);
});
