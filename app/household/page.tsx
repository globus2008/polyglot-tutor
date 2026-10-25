import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiKeyForm } from "@/components/api-key-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, inputClass } from "@/components/ui";
import { getKeyInfo } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { getEmails } from "@/lib/households";
import { localDay } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";
import {
  deleteHousehold,
  leaveHousehold,
  removeHouseholdKey,
  removeMember,
  revokeInvite,
  saveHouseholdKey,
  setHouseholdLimit,
  setMemberLimit,
} from "./actions";
import { CreateHouseholdForm, InviteLink } from "./forms";

export const metadata: Metadata = { title: "Rodina – Polyglot Tutor" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeZone: "Europe/Prague" });
const LIMIT_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90, 120];

export default function HouseholdPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Rodina</h1>
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <HouseholdContent />
      </Suspense>
    </div>
  );
}

async function HouseholdContent() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: me } = await supabase
    .from("household_members")
    .select("household_id, role, households(name, daily_minutes_limit)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me?.households) {
    return (
      <Card title="Sdílený klíč pro rodinu">
        <p className="mb-4 text-sm text-muted-foreground">
          Založte rodinu, zadejte do ní jeden OpenAI klíč a pozvěte ostatní odkazem. Členové pak nemusí mít vlastní
          klíč; každému nastavíte denní limit minut, abyste měli náklady pod kontrolou.
        </p>
        <CreateHouseholdForm />
        <p className="mt-4 text-sm text-muted-foreground">
          Máte pozvánku do rodiny? Otevřete odkaz, který vám poslal správce rodiny.
        </p>
      </Card>
    );
  }

  const householdId = me.household_id;
  const household = me.households;
  const owner = me.role === "owner";
  const today = localDay(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: members }, { data: usage }, { data: invites }, keyInfo] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, role, daily_minutes_limit, joined_at")
      .eq("household_id", householdId)
      .order("joined_at"),
    supabase
      .from("usage_daily")
      .select("user_id, day, audio_seconds")
      .eq("household_id", householdId)
      .gte("day", monthStart),
    owner
      ? supabase
          .from("household_invites")
          .select("id, created_at, expires_at")
          .eq("household_id", householdId)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    getKeyInfo({ kind: "household", id: householdId }),
  ]);
  const emails = await getEmails((members ?? []).map((m) => m.user_id));

  const minutes = (userId: string, fromDay: string) =>
    Math.round(
      (usage ?? []).filter((u) => u.user_id === userId && u.day >= fromDay).reduce((s, u) => s + u.audio_seconds, 0) /
        60,
    );

  return (
    <>
      <Card title={household.name}>
        <p className="text-sm text-muted-foreground">
          {owner ? "Jste správce rodiny." : "Jste členem rodiny."} Pokud nemáte vlastní klíč, lekce běží na rodinném klíči
          s denním limitem.
        </p>
      </Card>

      <Card title="Rodinný OpenAI klíč">
        {keyInfo ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
            <span>
              Uložený klíč <code className="font-mono">sk-…{keyInfo.last4}</code>, změněn{" "}
              {dateFormat.format(new Date(keyInfo.updatedAt))}
            </span>
            {owner && (
              <form action={removeHouseholdKey}>
                <SubmitButton variant="danger" pendingText="Mažu…">
                  Smazat
                </SubmitButton>
              </form>
            )}
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            {owner ? "Rodina zatím nemá klíč." : "Správce rodiny zatím nezadal klíč."}
          </p>
        )}
        {owner && <ApiKeyForm hasKey={Boolean(keyInfo)} saveAction={saveHouseholdKey} />}
      </Card>

      <Card title="Členové a spotřeba">
        <ul className="divide-y divide-line">
          {(members ?? []).map((m) => {
            const limit = m.daily_minutes_limit ?? household.daily_minutes_limit;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium">{emails.get(m.user_id) || "člen"}</span>
                  {m.role === "owner" && <span className="ml-2 text-xs text-muted-foreground">správce</span>}
                  {m.user_id === user.id && <span className="ml-2 text-xs text-muted-foreground">vy</span>}
                  {(owner || m.user_id === user.id) && (
                    <span className="block text-muted-foreground">
                      Dnes {minutes(m.user_id, today)} / {limit} min · tento měsíc {minutes(m.user_id, monthStart)} min
                    </span>
                  )}
                </span>
                {owner && (
                  <span className="flex items-center gap-2">
                    <form action={setMemberLimit} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <select
                        name="limit"
                        defaultValue={m.daily_minutes_limit ?? ""}
                        aria-label="Denní limit"
                        className={`${inputClass} w-auto py-1.5 text-sm`}
                      >
                        <option value="">výchozí ({household.daily_minutes_limit} min)</option>
                        {LIMIT_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n === 0 ? "bez lekcí" : `${n} min denně`}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="secondary" pendingText="…">
                        Uložit
                      </SubmitButton>
                    </form>
                    {m.user_id !== user.id && (
                      <form action={removeMember}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <SubmitButton variant="danger" pendingText="…" confirmText="Odebrat člena z rodiny?">
                          Odebrat
                        </SubmitButton>
                      </form>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {owner && (
          <form action={setHouseholdLimit} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="household-limit">Výchozí denní limit na člena:</label>
            <select
              id="household-limit"
              name="limit"
              defaultValue={household.daily_minutes_limit}
              className={`${inputClass} w-auto py-1.5 text-sm`}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </select>
            <SubmitButton variant="secondary" pendingText="…">
              Uložit
            </SubmitButton>
          </form>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Počítají se jen minuty na rodinném klíči. Kdo má v Nastavení vlastní klíč, platí si lekce sám a limit se na něj
          nevztahuje.
        </p>
      </Card>

      {owner && (
        <Card title="Pozvat člena">
          <InviteLink />
          {!!invites?.length && (
            <ul className="mt-4 space-y-2 text-sm">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Pozvánka z {dateFormat.format(new Date(invite.created_at))}, platí do{" "}
                    {dateFormat.format(new Date(invite.expires_at))}
                  </span>
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={invite.id} />
                    <SubmitButton variant="secondary" pendingText="…">
                      Zrušit
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <form action={owner ? deleteHousehold : leaveHousehold}>
        <SubmitButton
          variant="danger"
          pendingText="…"
          confirmText={
            owner
              ? "Opravdu zrušit rodinu? Členové přijdou o sdílený klíč a rodinný klíč se smaže."
              : "Opravdu opustit rodinu? Lekce pak poběží jen na vlastním klíči."
          }
        >
          {owner ? "Zrušit rodinu (smaže i rodinný klíč)" : "Opustit rodinu"}
        </SubmitButton>
      </form>
    </>
  );
}
