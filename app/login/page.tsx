import { Suspense } from "react";
import LoginContent from "./LoginContent";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
      <div className="text-white/60">Loading...</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
