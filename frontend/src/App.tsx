import { createBrowserRouter, RouterProvider } from "react-router"
import { RootLayout } from "@/components/layout/RootLayout"
import { PublicLayout } from "@/components/layout/PublicLayout"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

import LandingPage from "@/pages/LandingPage"
import LoginPage from "@/pages/LoginPage"
import SignupPage from "@/pages/SignupPage"
import ForgotPasswordPage from "@/pages/ForgotPasswordPage"
import DashboardPage from "@/pages/DashboardPage"
import SettingsPage from "@/pages/SettingsPage"
import MeliCallbackPage from "@/pages/MeliCallbackPage"
import AgentWizardPage from "@/pages/AgentWizardPage"
import AgentDetailPage from "@/pages/AgentDetailPage"
import NotFoundPage from "@/pages/NotFoundPage"

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: "/", element: <LandingPage /> },
          { path: "/login", element: <LoginPage /> },
          { path: "/signup", element: <SignupPage /> },
          { path: "/forgot-password", element: <ForgotPasswordPage /> },
        ],
      },
      {
        path: "/app",
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "settings", element: <SettingsPage /> },
              { path: "meli/callback", element: <MeliCallbackPage /> },
              { path: "agent/:id", element: <AgentDetailPage /> },
            ],
          },
          { path: "agent/new", element: <AgentWizardPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
