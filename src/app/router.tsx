/* oxlint-disable react/only-export-components -- breaker 테스트가 route guard를 직접 검증한다. */
import { useQuery } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { api } from "../api/service";
import { AppShell } from "../components/shell/AppShell";
import { StatusPanel } from "../components/ui/StatusPanel";
import { useAuth, LoginPage, OnboardingPage } from "../features/auth";
import { ConversationPage } from "../features/conversation";
import { HomePage } from "../features/home";
import { MyAccountPage, ProfileEditPage } from "../features/account";
import { RoomListPage } from "../features/rooms";
import { InterviewPage } from "../features/interview";
import { PracticePage } from "../features/practice";
import { ResultPage } from "../features/results";

export function RequireAuth() {
  const { session, isLoading } = useAuth();
  if (isLoading) return <StatusPanel title="세션을 확인하고 있어요" />;
  if (!session) return <Navigate to="/login" replace />;
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
  { path: "/login", element: <LoginPage /> },
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
          { path: "/interview", element: <InterviewPage /> },
          { path: "/results/:roomId", element: <ResultPage /> },
          { path: "/me", element: <MyAccountPage /> },
          { path: "/me/edit", element: <ProfileEditPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
