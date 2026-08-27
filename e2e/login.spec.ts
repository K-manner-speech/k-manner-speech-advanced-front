import { expect, test } from "@playwright/test";

test("로그인 화면은 데스크톱과 모바일에서 필수 입력과 안내를 제공한다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "한국어 대화를 편안하게 연습하세요" })).toBeVisible();
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("올바른 이메일을 입력해 주세요."), "AC-T7-LOGIN-E2E").toBeVisible();
  await expect(page.getByText("비밀번호는 6자 이상 입력해 주세요.")).toBeVisible();
});

test("원격 자격 증명이 제공되면 실제 Catalog 진입을 확인한다", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "원격 시연 계정은 선택 실행입니다.");
  test.skip(testInfo.project.name !== "chromium", "공유 원격 계정의 온보딩은 한 번만 실행합니다.");
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("비밀번호").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "로그인" }).click();

  const onboarding = page.getByRole("heading", { name: "기본 정보를 확인해 주세요" });
  const practiceLink = page.getByRole("link", { name: /상황별 대화 연습/ });
  await expect(onboarding.or(practiceLink)).toBeVisible({ timeout: 15_000 });
  if (await onboarding.isVisible()) {
    await page.getByLabel("이름").fill("Demo Learner");
    await page.getByLabel("생년월일").fill("1995-06-15");
    await page.getByLabel("성별").selectOption("other");
    await page.getByLabel("모국어").fill("English");
    await page.getByLabel(/이용약관과 개인정보 처리에 동의/).check();
    await page.getByRole("button", { name: "저장하고 시작하기" }).click();
  }

  await expect(page).toHaveURL(/\/$/);
  await expect(practiceLink).toBeVisible();
  await practiceLink.click();
  await expect(page.getByRole("heading", { name: /누구와 어떤 대화를/ })).toBeVisible({
    timeout: 15_000,
  });
});
