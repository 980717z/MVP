"use client";

import LoginForm from "@/components/LoginForm";

// Campus-branded sign-in (bentoos.io/campus/login). Same auth + redirect as
// /login; only the wordmark reads "BentoOS Campus". Kept separate so campus
// vendors get campus branding while sharing one hardened login implementation.
export default function CampusLogin() {
  return <LoginForm campus />;
}
