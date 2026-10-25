"use client";

import { useState, useTransition } from "react";
import { buttonClass, FormMessage } from "@/components/ui";
import { joinHousehold, type FormState } from "../../household/actions";

export function JoinButton({ token }: { token: string }) {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await joinHousehold(token)))}
        className={`${buttonClass()} w-full`}
      >
        {pending ? "Připojuji…" : "Připojit se k rodině"}
      </button>
      <FormMessage status={state.status} message={state.message} />
    </div>
  );
}
