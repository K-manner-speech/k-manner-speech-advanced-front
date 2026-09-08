/* oxlint-disable react/only-export-components -- breaker 테스트가 route guard를 직접 검증한다. */
import { useQuery } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { api } from "../api/service";
import { AppShell } from "../components/shell/AppShell";
import { StatusPanel } from "../components/ui/StatusPanel";
import { useAuth, LoginPage, OnboardingPage, SignupPage, StartPage } from "../features/auth";
import { ConversationPage, InterviewCompletePage } from "../features/conversation";
import { HomePage } from "../features/home";
import {
  EmailChangePage,
  LanguageSettingPage,
  MyAccountPage,
  PasswordChangePage,
  ProfileEditPage,
  SecurityPage,
} from "../features/account";
import { RoomListPage } from "../features/rooms";
import { InterviewPage } from "../features/interview";
import { PracticePage } from "../features/practice";
import { ResultListPage, ResultPage } from "../features/results";

export function RequireAuth() {
  const { session, isLoading } = useAuth();
  if (isLoading) return <StatusPanel title="세션을 확인하고 있어요" />;
  if (!session) return <Navigate to="/start" replace />;
  return <Outlet />;
}

function RequireOnboarding() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  if (me.isLoading) return <StatusPanel title="사용자 정보를 준비하고 있어요" />;
  if (me.error) return <StatusPanel title="사용자 정보를 불러오지 못했어요" detail={me.error.message} onRetry={() => void me.refetch()} />;
  if (!me.data?.onboarding_status.completed) return <Navigate to="/onboarding" replace />;
  return <AppShell><Outlet /></AppShell>;
}

export const router = createBrowserRouter([
  { path: "/start", element: <StartPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/onboarding", element: <OnboardingPage /> },
      {
        element: <RequireOnboarding />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "/practice", element: <PracticePage /> },
          { path: "/rooms", element: <RoomListPage /> },
          { path: "/rooms/:roomId", element: <ConversationPage /> },
          { path: "/rooms/:roomId/interview-complete", element: <InterviewCompletePage /> },
          { path: "/interview", element: <InterviewPage /> },
          { path: "/results", element: <ResultListPage /> },
          { path: "/results/:resultId", element: <ResultPage source="result" /> },
          { path: "/results/:resultId/scores", element: <ResultPage source="result" view="scores" /> },
          { path: "/results/:resultId/strengths", element: <ResultPage source="result" view="strengths" /> },
          { path: "/results/:resultId/strengths/:key", element: <ResultPage source="result" view="strength-detail" /> },
          { path: "/results/:resultId/improvements", element: <ResultPage source="result" view="improvements" /> },
          { path: "/results/:resultId/improvements/:key", element: <ResultPage source="result" view="improvement-detail" /> },
          { path: "/rooms/:roomId/result", element: <ResultPage source="room" /> },
          { path: "/me", element: <MyAccountPage /> },
          { path: "/me/edit", element: <ProfileEditPage /> },
          { path: "/me/language/native", element: <LanguageSettingPage kind="native" /> },
          { path: "/me/language/display", element: <LanguageSettingPage kind="display" /> },
          { path: "/me/security", element: <SecurityPage /> },
          { path: "/me/security/email", element: <EmailChangePage /> },
          { path: "/me/security/password", element: <PasswordChangePage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
