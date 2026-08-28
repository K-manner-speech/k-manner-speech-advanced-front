import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    session: null,
    isLoading: false,
    ...auth,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderAuth(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("로그인 화면의 회원가입 버튼은 A03 공개 화면으로 이동한다", async () => {
  const user = userEvent.setup();
  renderAuth("/login");

  await user.click(screen.getByRole("link", { name: /회원가입/ }));

  expect(screen.getByRole("heading", { name: /K-Manner Speech와\s*함께 시작해요/ })).toBeInTheDocument();
  expect(screen.getByText("가입 1/2 · Sign up")).toBeInTheDocument();
});

test("비밀번호 확인과 필수 약관이 유효하지 않으면 가입 요청을 보내지 않는다", async () => {
  const user = userEvent.setup();
  renderAuth("/signup");

  await user.type(screen.getByLabelText("이메일 · Email"), "new@example.com");
  await user.type(screen.getByLabelText("비밀번호 · Password"), "password1");
  await user.type(screen.getByLabelText("비밀번호 확인 · Confirm"), "password2");
  await user.click(screen.getByRole("button", { name: "회원가입 · Create account" }));

  expect(await screen.findByText("비밀번호가 일치하지 않습니다.")).toBeInTheDocument();
  expect(screen.getByText("필수 약관에 동의해 주세요.")).toBeInTheDocument();
  expect(auth.signUp).not.toHaveBeenCalled();
});

test("유효한 A03 폼은 Supabase 회원가입 후 로그인 안내로 이동한다", async () => {
  auth.signUp.mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderAuth("/signup");

  await user.type(screen.getByLabelText("이메일 · Email"), "new@example.com");
  await user.type(screen.getByLabelText("비밀번호 · Password"), "password1");
  await user.type(screen.getByLabelText("비밀번호 확인 · Confirm"), "password1");
  await user.click(screen.getByRole("checkbox", { name: /필수.*약관/ }));
  await user.click(screen.getByRole("button", { name: "회원가입 · Create account" }));

  expect(auth.signUp).toHaveBeenCalledWith("new@example.com", "password1");
  expect(await screen.findByRole("alert")).toHaveTextContent("회원가입 요청이 완료되었습니다");
});

test("Supabase 회원가입 실패는 입력 화면에 접근 가능한 오류로 남는다", async () => {
  auth.signUp.mockRejectedValue(new Error("이미 가입된 이메일입니다."));
  const user = userEvent.setup();
  renderAuth("/signup");

  await user.type(screen.getByLabelText("이메일 · Email"), "used@example.com");
  await user.type(screen.getByLabelText("비밀번호 · Password"), "password1");
  await user.type(screen.getByLabelText("비밀번호 확인 · Confirm"), "password1");
  await user.click(screen.getByRole("checkbox", { name: /필수.*약관/ }));
  await user.click(screen.getByRole("button", { name: "회원가입 · Create account" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("이미 가입된 이메일입니다.");
  expect(screen.getByLabelText("이메일 · Email")).toHaveValue("used@example.com");
});
