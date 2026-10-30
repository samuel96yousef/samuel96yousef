/**
 * Printing and PDF files on the web. Printing puts the document in a hidden
 * frame and opens the browser's print dialog on it. A PDF is drawn here
 * (canvasPdf.ts) and handed over as a download: through Claude's download
 * capability when the app runs inside Claude (where the print dialog never
 * opens), otherwise as an ordinary browser download.
 */
import { renderPdf } from './canvasPdf';
import type { Paper } from './html';
import type { PrintDoc } from './output';

export type { PrintDoc } from './output';

export const SAVES_FILE = true;
/** Inside Claude the print dialog never opens, so only the PDF is offered there. */
export const canPrint = () => !(window as unknown as { claude?: unknown }).claude;

export async function printDocument(html: string, _paper: Paper) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  // Off screen rather than hidden: some browsers print nothing from a hidden frame.
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;';
  const loaded = new Promise<void>((resolve) => { frame.onload = () => resolve(); });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await loaded;
  const win = frame.contentWindow;
  if (!win) { frame.remove(); throw new Error('Could not open the print view'); }
  await win.document.fonts.ready;
  const done = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', done, { once: true });
  win.focus();
  win.print();
  // Browsers that never fire afterprint still get their frame removed.
  setTimeout(done, 120_000);
}

const fileName = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Koptisk bönbok'}.pdf`;

export async function savePdf({ parts, options, title }: PrintDoc) {
  const blob = await renderPdf(parts, options);
  const filename = fileName(title);
  type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
  const claude = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  const downloads = (claude?.use ? await claude.use('downloads').catch(() => null) : null) as Downloads | null;
  if (downloads) {
    try { await downloads.save({ filename, data: blob }); }
    catch (e) {
      // The viewer said no: not a failure.
      if ((e as { code?: string })?.code === 'declined') throw new Error('cancelled');
      throw e;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
