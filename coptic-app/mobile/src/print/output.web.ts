/**
 * Printing on the web: the document goes into a hidden frame and the
 * browser's print dialog opens on it. "Save as PDF" there makes the file;
 * the document's title is its suggested name.
 */
import type { Paper } from './html';

export const SAVES_FILE = false;

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

export const savePdf = (html: string, paper: Paper, _name: string) => printDocument(html, paper);
