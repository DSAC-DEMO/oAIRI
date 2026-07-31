import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';

/**
 * QRCodePoster — roadshow-friendly QR for survey access.
 *
 * Encodes the survey landing page URL. Unlike pAIRI, the code is NOT baked
 * into the query string — the visitor scans, lands on the normal landing
 * page, and types the access code themselves into the empty code-entry box.
 *
 * Self-contained: owns its QR rendering plus the "Download PNG" and
 * "Print poster" artefacts so callers (e.g. AdminPage) stay thin.
 */
export default function QRCodePoster({
  url,
  code,
  title,
  appName = 'oAIRI',
  subtitle = 'Organisational AI Readiness Index',
  accentColor = '#16a34a',
  size = 150,
}) {
  const [preview, setPreview] = useState('');

  // On-screen preview (small).
  useEffect(() => {
    if (!url) { setPreview(''); return; }
    let alive = true;
    QRCode.toDataURL(url, {
      width: 512, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(d => { if (alive) setPreview(d); })
      .catch(() => { if (alive) setPreview(''); });
    return () => { alive = false; };
  }, [url]);

  // High-resolution PNG for printing/downloading.
  const hiResDataUrl = useCallback(
    () => QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' }),
    [url],
  );

  const downloadPng = useCallback(async () => {
    try {
      const dataUrl = await hiResDataUrl();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${appName}-survey-${code || 'qr'}.png`;
      a.click();
    } catch { /* ignore — preview already signals failure */ }
  }, [hiResDataUrl, appName, code]);

  const printPoster = useCallback(async () => {
    let dataUrl;
    try { dataUrl = await hiResDataUrl(); } catch { return; }
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return; // pop-up blocked
    const plainUrl = url.replace(/^https?:\/\//, '');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
      <title>${appName} — Scan to begin</title>
      <style>
        *{box-sizing:border-box} html,body{height:100%}
        body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:56px 48px;text-align:center;color:#0f172a}
        .eyebrow{letter-spacing:.25em;text-transform:uppercase;font-size:14px;font-weight:700;color:${accentColor}}
        h1{font-size:44px;margin:10px 0 2px}
        .sub{font-size:18px;color:#475569;margin-bottom:28px}
        .scan{font-size:28px;font-weight:700;margin:24px 0 16px}
        img{width:360px;height:360px}
        .hint{font-size:15px;color:#64748b;margin-top:10px}
        .fallback{margin-top:30px;font-size:15px;color:#334155;line-height:1.7}
        .code{font-family:monospace;font-size:24px;letter-spacing:.15em;font-weight:700}
      </style></head><body>
      <div class="eyebrow">${title || 'AI Readiness Roadshow'}</div>
      <h1>${appName}</h1>
      <div class="sub">${subtitle}</div>
      <div class="scan">Scan to open the survey</div>
      <img src="${dataUrl}" alt="Survey access QR code" />
      <div class="hint">Point your phone camera at the code</div>
      <div class="fallback">Can't scan? Visit <b>${plainUrl}</b><br/>then enter code <span class="code">${code || ''}</span> when prompted</div>
      <script>const i=document.images[0];function p(){window.focus();window.print()}i.complete?p():i.addEventListener('load',p)<\/script>
      </body></html>`);
    w.document.close();
  }, [hiResDataUrl, url, code, title, appName, subtitle, accentColor]);

  return (
    <div className="flex items-center gap-3">
      {preview
        ? <img src={preview} alt="Survey access QR code" width={size} height={size}
               className="rounded-lg border border-gray-200 bg-white flex-shrink-0" />
        : <div style={{ width: size, height: size }}
               className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
            Generating…
          </div>}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={printPoster}
          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap"
        >
          Print poster
        </button>
        <button
          type="button"
          onClick={downloadPng}
          className="text-xs bg-white border border-green-200 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap"
        >
          Download PNG
        </button>
      </div>
    </div>
  );
}
