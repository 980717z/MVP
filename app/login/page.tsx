"use client";

import LoginForm from "@/components/LoginForm";

// Platform sign-in. All logic lives in the shared LoginForm (also used by
// /campus/login, which only swaps the wordmark).
export default function Login() {
  return <LoginForm />;
}
