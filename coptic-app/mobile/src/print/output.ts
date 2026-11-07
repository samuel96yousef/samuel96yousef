/** Printing and PDF files on a phone: the system print sheet, or a PDF handed to the share sheet. */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { PAGE_POINTS, type Paper, type PrintOptions, type PrintPart } from './html';

/** A document to print or save: its HTML, and the parts it was made from (the web draws its PDF from those). */
export interface PrintDoc { html: string; parts: PrintPart[]; options: PrintOptions; title: string }

/** On a phone the PDF is a file of its own; on the web it is saved from the print dialog. */
export const SAVES_FILE = true;
export const canPrint = () => true;

// iOS takes the margins here; Android takes them from the page's @page rule (html.ts FRAME), in points.
const MARGINS = { A4: { top: 20, right: 20, bottom: 31, left: 20 }, A5: { top: 14, right: 14, bottom: 25.5, left: 14 } };

export async function printDocument(html: string, paper: Paper) {
  await Print.printAsync({ html, ...PAGE_POINTS[paper], margins: MARGINS[paper] });
}

export async function savePdf({ html, options, title: name }: PrintDoc) {
  const paper = options.paper;
  const { uri } = await Print.printToFileAsync({ html, ...PAGE_POINTS[paper], margins: MARGINS[paper] });
  // A readable name, so the file is recognisable in Files, Mail or a chat.
  const file = new File(Paths.cache, `${name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Koptisk bönbok'}.pdf`);
  if (file.exists) file.delete();
  await new File(uri).move(file);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}
