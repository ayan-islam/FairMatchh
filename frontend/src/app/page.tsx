import { Suspense } from "react";
import { FairMatchApp } from "@/components/fairmatch/fairmatch-app";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, color: "#007d73" }}>Loading FairMatch…</div>
      }
    >
      <FairMatchApp />
    </Suspense>
  );
}
