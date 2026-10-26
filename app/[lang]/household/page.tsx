import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiKeyForm } from "@/components/api-key-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, inputClass } from "@/components/ui";
import { getKeyInfo } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { getEmails, getUsersWithOwnKey } from "@/lib/households";
import { INTL_LOCALE } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { localDay } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";
import { estimateCostRange, formatUsd } from "@/lib/usage";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.household };
}

const LIMIT_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90, 120];

export default async function HouseholdPage() {
  const t = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.household.title}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.common.loading}</p>}>
        <HouseholdContent />
      </Suspense>
    </div>
  );
}

async function HouseholdContent() {
  const [t, locale, user] = await Promise.all([getDictionary(), getLocale(), getCurrentUser()]);
  const supabase = await createClient();
  const { data: me } = await supabase
    .from("household_members")
    .select("household_id, role, households(name, daily_minutes_limit)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me?.households) {
    return (
      <Card title={t.household.createTitle}>
        <p className="mb-4 text-sm text-muted-foreground">{t.household.createIntro}</p>
        <CreateHouseholdForm />
        <p className="mt-4 text-sm text-muted-foreground">{t.household.haveInvite}</p>
      </Card>
    );
  }

  const householdId = me.household_id;
  const household = me.households;
  const owner = me.role === "owner";
  const today = localDay(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium", timeZone: "Europe/Prague" });

  const [{ data: members }, { data: usage }, { data: invites }, keyInfo] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, role, daily_minutes_limit, joined_at")
      .eq("household_id", householdId)
      .order("joined_at"),
    supabase.from("usage_daily").select("user_id, day, audio_seconds").eq("household_id", householdId).gte("day", monthStart),
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
  const memberIds = (members ?? []).map((m) => m.user_id);
  const [emails, ownKey] = await Promise.all([getEmails(memberIds), getUsersWithOwnKey(memberIds)]);

  const minutes = (userId: string, fromDay: string) =>
    Math.round(
      (usage ?? []).filter((u) => u.user_id === userId && u.day >= fromDay).reduce((s, u) => s + u.audio_seconds, 0) / 60,
    );

  const monthMinutes = Math.round((usage ?? []).reduce((s, u) => s + u.audio_seconds, 0) / 60);
  const monthCost = estimateCostRange(monthMinutes).map((usd) => formatUsd(usd, INTL_LOCALE[locale])) as [string, string];

  return (
    <>
      <Card title={household.name}>
        <p className="text-sm text-muted-foreground">
          {owner ? t.household.youAreOwner : t.household.youAreMember}
          {t.household.sharedKeyNote}
        </p>
      </Card>

      <Card title={t.household.keyTitle}>
        {keyInfo ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
            <span>{t.apiKey.stored(keyInfo.last4, dateFormat.format(new Date(keyInfo.updatedAt)))}</span>
            {owner && (
              <form action={removeHouseholdKey}>
                <SubmitButton variant="danger" pendingText={t.common.deleting}>
                  {t.common.delete}
                </SubmitButton>
              </form>
            )}
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">{owner ? t.household.noKeyOwner : t.household.noKeyMember}</p>
        )}
        {owner && <ApiKeyForm hasKey={Boolean(keyInfo)} saveAction={saveHouseholdKey} />}
      </Card>

      <Card title={t.household.members}>
        <ul className="divide-y divide-line">
          {(members ?? []).map((m) => {
            const limit = m.daily_minutes_limit ?? household.daily_minutes_limit;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium">{emails.get(m.user_id) || t.household.member}</span>
                  {m.role === "owner" && <span className="ml-2 text-xs text-muted-foreground">{t.household.admin}</span>}
                  {m.user_id === user.id && <span className="ml-2 text-xs text-muted-foreground">{t.household.you}</span>}
                  {(owner || m.user_id === user.id) && (
                    <span className="block text-muted-foreground">
                      {t.household.usage(minutes(m.user_id, today), limit, minutes(m.user_id, monthStart))}
                    </span>
                  )}
                  {ownKey.has(m.user_id) && <span className="block text-xs text-muted-foreground">{t.household.ownKey}</span>}
                </span>
                {owner && (
                  <span className="flex items-center gap-2">
                    <form action={setMemberLimit} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <select
                        name="limit"
                        defaultValue={m.daily_minutes_limit ?? ""}
                        aria-label={t.household.limitLabel}
                        className={`${inputClass} w-auto py-1.5 text-sm`}
                      >
                        <option value="">{t.household.limitDefault(household.daily_minutes_limit)}</option>
                        {LIMIT_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n === 0 ? t.household.noLessons : t.household.perDay(n)}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="secondary" pendingText="…">
                        {t.common.save}
                      </SubmitButton>
                    </form>
                    {m.user_id !== user.id && (
                      <form action={removeMember}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <SubmitButton variant="danger" pendingText="…" confirmText={t.household.removeConfirm}>
                          {t.household.remove}
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
            <label htmlFor="household-limit">{t.household.defaultLimit}</label>
            <select
              id="household-limit"
              name="limit"
              defaultValue={household.daily_minutes_limit}
              className={`${inputClass} w-auto py-1.5 text-sm`}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {t.common.minutesShort(n)}
                </option>
              ))}
            </select>
            <SubmitButton variant="secondary" pendingText="…">
              {t.common.save}
            </SubmitButton>
          </form>
        )}
        {owner && <p className="mt-4 text-sm font-medium">{t.household.monthTotal(monthMinutes, ...monthCost)}</p>}
        <p className="mt-3 text-xs text-muted-foreground">{t.household.usageNote}</p>
      </Card>

      {owner && (
        <Card title={t.household.inviteTitle}>
          <InviteLink />
          {!!invites?.length && (
            <ul className="mt-4 space-y-2 text-sm">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t.household.inviteRow(
                      dateFormat.format(new Date(invite.created_at)),
                      dateFormat.format(new Date(invite.expires_at)),
                    )}
                  </span>
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={invite.id} />
                    <SubmitButton variant="secondary" pendingText="…">
                      {t.household.revoke}
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
          confirmText={owner ? t.household.deleteConfirm : t.household.leaveConfirm}
        >
          {owner ? t.household.deleteHousehold : t.household.leave}
        </SubmitButton>
      </form>
    </>
  );
}
