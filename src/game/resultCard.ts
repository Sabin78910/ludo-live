// Share-a-result card: a pure model (tested) plus a small canvas renderer and share helper.
import type { Color, Mode } from "../engine/rules";
import { t, type Lang, type StringKey } from "./i18n";

export const HASH_PREFIX_LEN = 10;

export interface CardPlace {
  place: number;
  name: string;
  color: Color;
  label: string;
}

export interface ResultCardModel {
  title: string;
  places: CardPlace[];
  modeLabel: string;
  verified: boolean;
  badge: string;
  hashPrefix: string;
  hashLine: string;
}

export function buildResultCard(input: {
  lang: Lang;
  order: { name: string; color: Color }[];
  mode: Mode;
  fair: { serverSeedHash: string; serverSeed: string | null };
}): ResultCardModel {
  const { lang, order, mode, fair } = input;
  const verified = !!fair.serverSeed && !!fair.serverSeedHash;
  const hashPrefix = fair.serverSeedHash.slice(0, HASH_PREFIX_LEN);
  return {
    title: t(lang, "cardTitle"),
    places: order.slice(0, 4).map((p, i) => ({ place: i + 1, name: p.name, color: p.color, label: t(lang, `place${i + 1}` as StringKey) })),
    modeLabel: t(lang, mode === "quick" ? "quickMode" : "classicMode"),
    verified,
    badge: t(lang, verified ? "diceVerified" : "diceCommitted"),
    hashPrefix,
    hashLine: t(lang, "cardHash", { hash: hashPrefix || "…" }),
  };
}

const COLOR_HEX: Record<Color, string> = { red: "#EF3B4F", green: "#22C55E", yellow: "#FACC15", blue: "#3B82F6" };
const FONT = "Outfit, system-ui, sans-serif";

/** Draws the card (1080x1080) and returns it as a PNG blob. */
export function renderCard(model: ResultCardModel): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return Promise.reject(new Error("Canvas is not available"));
  g.fillStyle = "#0B1026";
  g.fillRect(0, 0, size, size);
  g.textAlign = "center";
  g.fillStyle = "#ffffff";
  g.font = `700 64px ${FONT}`;
  g.fillText(model.title, size / 2, 120);
  g.fillStyle = "#B8C0DD";
  g.font = `500 36px ${FONT}`;
  g.fillText(model.modeLabel, size / 2, 180);

  const rowH = 150;
  model.places.forEach((p, i) => {
    const y = 260 + i * (rowH + 20);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.beginPath();
    g.roundRect(120, y, size - 240, rowH, 28);
    g.fill();
    g.fillStyle = COLOR_HEX[p.color];
    g.beginPath();
    g.arc(205, y + rowH / 2, 36, 0, Math.PI * 2);
    g.fill();
    g.textAlign = "left";
    g.fillStyle = "#ffffff";
    g.font = `600 52px ${FONT}`;
    g.fillText(p.name, 275, y + rowH / 2 + 18);
    g.textAlign = "right";
    g.fillStyle = "#F5C451";
    g.fillText(p.label, size - 160, y + rowH / 2 + 18);
  });

  g.textAlign = "center";
  g.fillStyle = model.verified ? "#22C55E" : "#B8C0DD";
  g.font = `700 44px ${FONT}`;
  g.fillText(model.badge, size / 2, 960);
  g.fillStyle = "#B8C0DD";
  g.font = `500 30px ${FONT}`;
  g.fillText(model.hashLine, size / 2, 1015);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}

export const cardFileName = () => "ludo-live-result.png";

interface ShareNav {
  share?(data: ShareData): Promise<void>;
  canShare?(data: ShareData): boolean;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shares the PNG through the native share sheet, falling back to a download. */
export async function shareCard(
  blob: Blob,
  text: string,
  nav: ShareNav,
  download: (b: Blob, name: string) => void = downloadBlob,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], cardFileName(), { type: "image/png" });
  const data: ShareData = { files: [file], text };
  if (nav.share && nav.canShare?.(data)) {
    try {
      await nav.share(data);
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  download(blob, cardFileName());
  return "downloaded";
}
