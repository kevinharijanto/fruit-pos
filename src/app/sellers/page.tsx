// src/app/sellers/page.tsx
import { Suspense } from "react";
import SellersPageClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SellersPageClient />
    </Suspense>
  );
}