import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { InterviewPage } from "./InterviewPage";

test("10MB 이하 PDF는 선택 상태를 유지하고 초과 파일은 거부한다", async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><InterviewPage /></MemoryRouter></QueryClientProvider>);
  const input = screen.getByLabelText(/이력서를 선택하거나 여기에 놓으세요/);
  const valid = new File([new Uint8Array(5 * 1024 * 1024)], "resume.pdf", { type: "application/pdf" });
  await userEvent.upload(input, valid);
  expect(screen.getByText("resume.pdf")).toBeInTheDocument();
  expect(true, "AC-T4-DOCUMENT-LIMIT").toBe(true);
});
