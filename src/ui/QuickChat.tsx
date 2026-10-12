import { QUICK_CHAT } from "../engine/protocol";
import { t, type Lang } from "../game/i18n";

const phraseText = (lang: Lang, id: string) => QUICK_CHAT.find((p) => p.id === id)?.[lang];

export interface BubbleItem {
  id: number;
  phraseId: string;
  name: string;
}

/** Speech bubbles for one player. The region is always mounted so screen readers announce new phrases. */
export function ChatBubbles(props: { lang: Lang; items: BubbleItem[]; hidden: boolean; muted: string[] }) {
  const shown = props.hidden ? [] : props.items.filter((i) => !props.muted.includes(i.name));
  return (
    <span role="status" aria-live="polite" className="chat-live">
      {shown.map((i) => {
        const text = phraseText(props.lang, i.phraseId);
        return text ? (
          <span key={i.id} className="chat-bubble">
            {text}
          </span>
        ) : null;
      })}
    </span>
  );
}

export interface QuickChatProps {
  lang: Lang;
  onSend(phraseId: string): void;
  hidden: boolean;
  onToggleHidden(): void;
  /** Names of the other human players, for per-player mute. */
  others: string[];
  muted: string[];
  onToggleMute(name: string): void;
}

export function QuickChat(p: QuickChatProps) {
  return (
    <div className="quick-chat" role="group" aria-label={t(p.lang, "quickChat")}>
      <div className="chat-phrases">
        {QUICK_CHAT.map((ph) => (
          <button key={ph.id} type="button" onClick={() => p.onSend(ph.id)}>
            {ph[p.lang]}
          </button>
        ))}
      </div>
      <div className="chat-prefs">
        <button type="button" aria-pressed={p.hidden} onClick={p.onToggleHidden}>
          {t(p.lang, p.hidden ? "showChat" : "hideChat")}
        </button>
        {p.others.map((name) => (
          <button key={name} type="button" aria-pressed={p.muted.includes(name)} onClick={() => p.onToggleMute(name)}>
            {t(p.lang, p.muted.includes(name) ? "unmuteName" : "muteName", { name })}
          </button>
        ))}
      </div>
    </div>
  );
}
