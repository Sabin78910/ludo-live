// QR code for a room invite, generated on the device (no network, no image service).
// Returns one SVG path of dark modules so the code scales crisply at any size.
import qrcode from "qrcode-generator";

export interface QrPath {
  /** Modules per side, excluding the quiet zone. */
  size: number;
  /** SVG path data in module units, offset by the quiet zone. */
  d: string;
}

export const QUIET_ZONE = 4;

export function qrPath(text: string): QrPath {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const size = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.isDark(r, c)) d += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { size, d };
}
