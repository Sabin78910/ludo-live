import { useRef, useState } from "react";
import { nicknameFrom, type Account } from "../game/account";
import { t, type Lang } from "../game/i18n";
import { currentAccount, signIn, signInEnabled, signOut } from "../online/google";

/** Optional "Sign in with Google" row for Settings. Hidden unless a client ID is built in. */
export function AccountRow({ lang, name, onName }: { lang: Lang; name: string; onName: (n: string) => void }) {
  const [account, setAccount] = useState<Account | null>(currentAccount);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const host = useRef<HTMLDivElement>(null);
  if (!signInEnabled()) return null;
  if (account)
    return (
      <div className="row-btns">
        <span>{t(lang, "signedInAs").replace("{name}", account.name)}</span>
        <button type="button" className="btn ghost" onClick={() => void signOut().then(() => setAccount(null))}>
          {t(lang, "signOut")}
        </button>
      </div>
    );
  const start = () => {
    setState("busy");
    signIn(host.current!, lang)
      .then((a) => {
        setAccount(a);
        setState("idle");
        if (!name.trim()) onName(nicknameFrom(a));
      })
      .catch(() => setState("failed"));
  };
  return (
    <div className="row-btns">
      <button type="button" className="btn" disabled={state === "busy"} onClick={start}>
        {t(lang, "signIn")}
      </button>
      <div ref={host} />
      {state === "failed" && <span role="status">{t(lang, "signInFailed")}</span>}
    </div>
  );
}
