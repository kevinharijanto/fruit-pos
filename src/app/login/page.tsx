import { Suspense } from "react";
import LoginPageClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient />
    </Suspense>
  );
}


