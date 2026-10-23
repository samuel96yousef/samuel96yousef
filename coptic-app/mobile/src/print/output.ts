/** Printing and PDF files on a phone: the system print sheet, or a PDF handed to the share sheet. */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { PAGE_POINTS, type Paper } from './html';

/** On a phone the PDF is a file of its own; on the web it is saved from the print dialog. */
export const SAVES_FILE = true;

// iOS takes the margins here; Android takes them from the page's @page rule.
const MARGINS = { A4: { top: 45, right: 42, bottom: 48, left: 42 }, A5: { top: 31, right: 28, bottom: 34, left: 28 } };

export async function printDocument(html: string, paper: Paper) {
  await Print.printAsync({ html, ...PAGE_POINTS[paper], margins: MARGINS[paper] });
}

export async function savePdf(html: string, paper: Paper, name: string) {
  const { uri } = await Print.printToFileAsync({ html, ...PAGE_POINTS[paper], margins: MARGINS[paper] });
  // A readable name, so the file is recognisable in Files, Mail or a chat.
  const file = new File(Paths.cache, `${name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Koptisk bönbok'}.pdf`);
  if (file.exists) file.delete();
  await new File(uri).move(file);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}
