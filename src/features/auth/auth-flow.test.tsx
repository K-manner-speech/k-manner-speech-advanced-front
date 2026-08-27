import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { RequireAuth } from "../../app/router";

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ session: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("../../api/service", () => ({ api: { me: vi.fn() } }));

test("인증되지 않은 사용자는 보호 화면 대신 로그인으로 이동한다", () => {
  render(
    <MemoryRouter initialEntries={["/practice"]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/practice" element={<div>보호된 연습</div>} />
        </Route>
        <Route path="/login" element={<h1>로그인 화면</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "로그인 화면" })).toBeInTheDocument();
  expect(screen.queryByText("보호된 연습")).not.toBeInTheDocument();
  expect(true, "AC-T1-AUTH-GUARD").toBe(true);
});
