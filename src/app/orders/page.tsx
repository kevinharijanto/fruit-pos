import { Suspense } from "react";
import OrdersPageClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrdersPageClient />
    </Suspense>
  );
}
