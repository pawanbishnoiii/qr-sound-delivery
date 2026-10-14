import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import type { Shipment } from "./status";
import { trackUrl } from "./shipments";

const esc = (v: string | number | null | undefined) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function barcodeDataUrl(code: string) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, code, { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0 });
  return canvas.toDataURL("image/png");
}

/** Opens a print window with one 4x6-style label per shipment (QR + Code128 barcode). */
export async function printLabels(list: Shipment[]) {
  const w = window.open("", "_blank", "width=520,height=720");
  if (!w) throw new Error("Allow pop-ups to print labels");
  const items = await Promise.all(
    list.map(async (s) => ({
      s,
      qr: await QRCode.toDataURL(trackUrl(s.tracking_code), { width: 300, margin: 0 }),
      bar: barcodeDataUrl(s.tracking_code),
    })),
  );
  w.document.write(`<html><head><title>Labels (${list.length})</title><style>
    *{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;padding:12px;color:#111}
    .l{border:2px solid #111;border-radius:8px;padding:14px;width:380px;margin:0 auto 14px;page-break-after:always}
    .h{display:flex;justify-content:space-between;font-weight:800;font-size:12px;letter-spacing:.1em;border-bottom:1px dashed #111;padding-bottom:6px}
    .bar{width:100%;height:60px;margin-top:10px}.c{font:700 18px monospace;text-align:center;margin:4px 0 8px}
    .g{display:flex;gap:10px}.r{font-size:12px;line-height:1.45;flex:1}
    .cod{margin-top:8px;padding:6px 10px;background:#111;color:#fff;display:inline-block;border-radius:5px;font-weight:800}
    @media print{body{padding:0}.l{margin:0 auto}}
  </style></head><body>${items
    .map(
      ({ s, qr, bar }) => `<div class="l"><div class="h"><span>ROUTEFLOW OS</span><span>${esc(s.city).toUpperCase()}</span></div>
      <img class="bar" src="${bar}"/><div class="c">${esc(s.tracking_code)}</div>
      <div class="g"><img src="${qr}" width="110" height="110"/><div class="r">
        <b>TO:</b> ${esc(s.receiver_name)}<br/>${esc(s.receiver_phone)}<br/>${esc(s.receiver_address)}, ${esc(s.city)} ${esc(s.pincode)}
        <br/><b>FROM:</b> ${esc(s.sender_name)}<br/>Wt ${esc(s.weight_kg)} kg${s.is_demo ? " · DEMO" : ""}
      </div></div>
      <div class="cod">${Number(s.cod_amount) > 0 ? `COD ₹${Number(s.cod_amount).toLocaleString("en-IN")}` : "PREPAID"}</div></div>`,
    )
    .join("")}<script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}
