// src/app/seller-orders/page.tsx
import { Suspense } from "react";
import SellerOrdersPageClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SellerOrdersPageClient />
    </Suspense>
  );
}