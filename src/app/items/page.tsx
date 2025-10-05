import { Suspense } from "react";
import ItemsPageClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ItemsPageClient />
    </Suspense>
  );
}
