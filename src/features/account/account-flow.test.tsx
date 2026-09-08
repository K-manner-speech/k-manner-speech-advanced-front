import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { api } from "../../api/service";
import { LanguageSettingPage } from "./LanguageSettingPage";
import { PasswordChangePage } from "./PasswordChangePage";
import { EmailChangePage } from "./EmailChangePage";
import { ProfileEditPage } from "./ProfileEditPage";

vi.mock("../../api/service", () => ({
  api: {
    me: vi.fn(), saveProfile: vi.fn(), saveLanguage: vi.fn(),
    changeEmail: vi.fn(), changePassword: vi.fn(),
  },
}));

vi.mock("../auth", () => ({ useAuth: () => ({ session: { user: { email: "minjun@example.com" } } }) }));

const me = {
  profile: { display_name: "민준", birth_date: "1998-06-18", gender: "male", native_language: "English" },
  display_language: "ko" as const,
  consents: [],
  onboarding_status: { completed: true, missing_requirements: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.me).mockResolvedValue(me as never);
  vi.mocked(api.saveProfile).mockResolvedValue(me as never);
  vi.mocked(api.saveLanguage).mockResolvedValue(me as never);
});

function renderPage(element: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter>
        <Routes><Route path="/" element={element} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test("모국어를 바꿔도 이 화면이 다루지 않는 프로필 값은 지워지지 않는다", async () => {
  renderPage(<LanguageSettingPage kind="native" />);

  await userEvent.click(await screen.findByRole("radio", { name: /日本語/ }));
  await userEvent.click(screen.getByRole("button", { name: "선택 완료" }));

  await waitFor(() => expect(api.saveProfile).toHaveBeenCalledWith({
    display_name: "민준", birth_date: "1998-06-18", gender: "male", native_language: "Japanese",
  }));
});

test("이미 고른 언어면 저장 버튼이 눌리지 않는다", async () => {
  renderPage(<LanguageSettingPage kind="display" />);

  expect(await screen.findByRole("radio", { name: /한국어/ })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("button", { name: "선택 완료" })).toBeDisabled();
});

test("프로필 수정은 다루지 않는 성별과 모국어를 그대로 실어 보낸다", async () => {
  renderPage(<ProfileEditPage />);

  await userEvent.clear(await screen.findByLabelText("이름"));
  await userEvent.type(screen.getByLabelText("이름"), "지민");
  await userEvent.click(screen.getByRole("button", { name: "수정 완료" }));

  await waitFor(() => expect(api.saveProfile).toHaveBeenCalledWith({
    display_name: "지민", birth_date: "1998-06-18", gender: "male", native_language: "English",
  }));
});

test("새 비밀번호를 두 번 다르게 적으면 서버로 보내지 않는다", async () => {
  renderPage(<PasswordChangePage />);

  await userEvent.type(screen.getByLabelText("현재 비밀번호"), "old-secret");
  await userEvent.type(screen.getByLabelText("새 비밀번호"), "new-secret-1");
  await userEvent.type(screen.getByLabelText("새 비밀번호 확인"), "new-secret-2");
  await userEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));

  expect(await screen.findByText("새 비밀번호가 서로 다릅니다.")).toBeInTheDocument();
  expect(api.changePassword).not.toHaveBeenCalled();
});

test("이메일 변경은 아직 끝나지 않았음을 알린다", async () => {
  vi.mocked(api.changeEmail).mockResolvedValue({ pending_email: "new@example.com" } as never);
  renderPage(<EmailChangePage />);

  await userEvent.type(screen.getByLabelText("새 이메일"), "new@example.com");
  await userEvent.click(screen.getByRole("button", { name: "확인 메일 보내기" }));

  // 바뀐 줄 알고 예전 주소를 버리면 계정에 다시 들어올 수 없다.
  expect(await screen.findByText(/확인 메일을 보냈어요/)).toBeInTheDocument();
  expect(screen.getByText(/링크를 눌러야 주소가 바뀝니다/)).toBeInTheDocument();
});
