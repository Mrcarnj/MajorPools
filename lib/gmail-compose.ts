/**
 * Gmail's compose-by-URL uses a single GET request; long BCC lists plus body
 * exceed server limits and return HTTP 400. Stay under a conservative cap.
 */
const GMAIL_COMPOSE_SAFE_URL_LENGTH = 6500;

export function buildGmailComposeUrl(options: {
  bccEmails: readonly string[];
  subject: string;
  body: string;
}): string {
  const bcc =
    options.bccEmails.length > 0
      ? `&bcc=${encodeURIComponent(options.bccEmails.join(','))}`
      : '';
  return `https://mail.google.com/mail/?view=cm&fs=1${bcc}&su=${encodeURIComponent(options.subject)}&body=${encodeURIComponent(options.body)}`;
}

function showBccCopyFallback(bccText: string, count: number): void {
  const existing = document.getElementById('gmail-compose-bcc-fallback');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'gmail-compose-bcc-fallback';
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:16px;';

  const card = document.createElement('div');
  card.style.cssText =
    'background:#fff;color:#111;max-width:560px;width:100%;max-height:85vh;display:flex;flex-direction:column;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.2);overflow:hidden;font-family:system-ui,-apple-system,sans-serif;';

  const title = document.createElement('h2');
  title.style.cssText = 'margin:0;padding:16px 16px 8px;font-size:1rem;font-weight:600;';
  title.textContent = `Paste into BCC (${count} addresses)`;

  const sub = document.createElement('p');
  sub.style.cssText = 'margin:0 16px 12px;font-size:0.875rem;line-height:1.45;color:#444;';
  sub.textContent =
    'Automatic copy was blocked (common after loading data). Use “Copy addresses” below, then in Gmail click BCC and paste (⌘V / Ctrl+V). You can also select the list and press ⌘C / Ctrl+C.';

  const ta = document.createElement('textarea');
  ta.value = bccText;
  ta.readOnly = true;
  ta.setAttribute('spellcheck', 'false');
  ta.style.cssText =
    'margin:0 16px;width:calc(100% - 32px);min-height:140px;max-height:42vh;font-size:12px;line-height:1.35;font-family:ui-monospace,monospace;resize:vertical;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;padding:8px;';

  const row = document.createElement('div');
  row.style.cssText =
    'display:flex;gap:8px;padding:16px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid #eee;';

  const btnCopy = document.createElement('button');
  btnCopy.type = 'button';
  btnCopy.textContent = 'Copy addresses';
  btnCopy.style.cssText =
    'padding:8px 14px;font-weight:500;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.875rem;';

  const btnDone = document.createElement('button');
  btnDone.type = 'button';
  btnDone.textContent = 'Close';
  btnDone.style.cssText =
    'padding:8px 14px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:0.875rem;';

  function close(): void {
    document.removeEventListener('keydown', onKey);
    wrap.remove();
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  btnDone.addEventListener('click', close);

  btnCopy.addEventListener('click', async () => {
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* ignore */
    }
    if (!ok) {
      try {
        await navigator.clipboard.writeText(bccText);
        ok = true;
      } catch {
        /* ignore */
      }
    }
    btnCopy.textContent = ok ? 'Copied!' : 'Select list, then ⌘C / Ctrl+C';
    if (ok) {
      window.setTimeout(() => {
        btnCopy.textContent = 'Copy addresses';
      }, 2000);
    }
  });

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close();
  });

  card.appendChild(title);
  card.appendChild(sub);
  card.appendChild(ta);
  row.appendChild(btnDone);
  row.appendChild(btnCopy);
  card.appendChild(row);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  ta.focus();
  ta.select();
}

/**
 * Opens Gmail compose in a new tab. If the URL would be too long, copies all
 * BCC addresses to the clipboard and opens compose without BCC so you can paste.
 */
export async function openGmailCompose(options: {
  bccEmails: readonly string[];
  subject: string;
  body: string;
}): Promise<void> {
  const unique = Array.from(
    new Set(options.bccEmails.map((e) => e.trim()).filter(Boolean)),
  );

  const fullUrl = buildGmailComposeUrl({
    bccEmails: unique,
    subject: options.subject,
    body: options.body,
  });

  if (fullUrl.length <= GMAIL_COMPOSE_SAFE_URL_LENGTH) {
    window.open(fullUrl, '_blank');
    return;
  }

  const shortUrl = buildGmailComposeUrl({
    bccEmails: [],
    subject: options.subject,
    body: options.body,
  });

  const bccLine = unique.join(', ');

  let copied = false;
  try {
    await navigator.clipboard.writeText(bccLine);
    copied = true;
  } catch {
    copied = false;
  }

  window.open(shortUrl, '_blank');

  if (copied) {
    window.setTimeout(() => {
      window.alert(
        `${unique.length} addresses were copied. In Gmail, click BCC and paste (⌘V on Mac, Ctrl+V on Windows), then send as usual.`,
      );
    }, 300);
  } else {
    showBccCopyFallback(bccLine, unique.length);
  }
}
