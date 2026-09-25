import { Suspense } from "react";
import { FairMatchApp } from "@/components/fairmatch/fairmatch-app";
import { LoadingState } from "@/components/fairmatch/shared";

export default function Home() {
  return (
    <Suspense
      fallback={<LoadingState label="Starting FairMatch" />}
    >
      <FairMatchApp />
    </Suspense>
  );
}
