import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { printFonts } from '../print/fonts';
import { printHtml, type PrintOptions, type PrintPart } from '../print/html';
import { canPrint, printDocument, savePdf, SAVES_FILE } from '../print/output';
import { useSettings } from '../settings';
import { Glyph } from './Glyph';
import { Icon } from './Icon';
import { Segmented } from './Segmented';

/** Something a screen offers to print: this day, this hour, the whole book … */
export interface PrintScope {
  key: string;
  label: string;
  /** A note under the label, such as that the document is large */
  sub?: string;
  /** The document's title, and the PDF's file name */
  title: string;
  load: () => Promise<PrintPart[]>;
}

/**
 * Print or save as PDF: what to include, in which language, on which paper,
 * how large and whether in colour. The choices are remembered. On a phone
 * the PDF goes to the share sheet (Files, Mail, AirDrop, a printer app); on
 * the web the browser's print dialog does both.
 */
export function PrintSheet({ visible, scopes, onClose }: { visible: boolean; scopes: PrintScope[]; onClose: () => void }) {
  const { t, lang, colors, printOpts, set } = useSettings();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [chosen, setChosen] = useState(scopes[0]?.key);
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const [error, setError] = useState(false);
  const ar = lang === 'ar';
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  const right = ar && styles.right;
  const wide = width >= 600;
  const scope = scopes.find((s) => s.key === chosen) ?? scopes[0];
  const opt = (patch: Partial<PrintOptions>) => set({ printOpts: { ...printOpts, ...patch } });

  const run = async (kind: 'print' | 'pdf') => {
    if (!scope || busy) return;
    setBusy(kind);
    setError(false);
    try {
      const [parts, fonts] = await Promise.all([scope.load(), printFonts()]);
      const html = printHtml(parts, printOpts, scope.title, fonts);
      if (kind === 'pdf') await savePdf({ html, parts, options: printOpts, title: scope.title });
      else await printDocument(html, printOpts.paper);
      onClose();
    } catch (e) {
      // Closing the print sheet without printing is not a failure.
      if (!/cancel|did not complete/i.test(String((e as Error)?.message))) setError(true);
    } finally {
      setBusy(null);
    }
  };

  const label = (text: string) => <Text style={[styles.label, { color: colors.label2 }, right]}>{text}</Text>;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.wrap, wide ? styles.wrapWide : null]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} accessibilityLabel={t.close} />
        <View style={[
          styles.card,
          wide ? { width: 440, borderRadius: 28 } : { alignSelf: 'stretch', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 14 },
          { maxHeight: height - insets.top - 24, backgroundColor: colors.bg, boxShadow: `0 24px 60px -20px ${colors.shadow}` },
        ]}>
          <View style={[styles.head, { flexDirection: row }]}>
            <View style={[styles.headIcon, { backgroundColor: colors.tint }]}><Icon name="print" size={20} color={colors.crimson} strokeWidth={2} /></View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.label }, right]}>{t.printTitle}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} hitSlop={8}
              style={({ pressed }) => [styles.close, { backgroundColor: colors.surface }, pressed && styles.dim]}>
              <Icon name="x" size={16} color={colors.label} strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {label(t.printWhat)}
            <View style={[styles.group, { backgroundColor: colors.surface }]}>
              {scopes.map((s, i) => {
                const on = s.key === scope?.key;
                return (
                  <Pressable key={s.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setChosen(s.key)}
                    style={({ pressed }) => [styles.option, { flexDirection: row }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.sep }, pressed && styles.dim]}>
                    <View style={[styles.radio, { borderColor: on ? colors.crimson : colors.label2 }]}>
                      {on && <View style={[styles.radioDot, { backgroundColor: colors.crimson }]} />}
                    </View>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, { color: colors.label }, right]}>{s.label}</Text>
                      {s.sub ? <Text style={[styles.optionSub, { color: colors.label2 }, right]}>{s.sub}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {label(t.printLangs)}
            <Segmented label={t.printLangs} value={printOpts.langs} onChange={(langs) => opt({ langs })}
              options={(ar
                ? [{ value: 'ar' as const, label: t.printAr }, { value: 'both' as const, label: t.printBoth }, { value: 'sv' as const, label: t.printSv }]
                : [{ value: 'sv' as const, label: t.printSv }, { value: 'both' as const, label: t.printBoth }, { value: 'ar' as const, label: t.printAr }])} />

            <View style={[styles.pairRow, { flexDirection: row }]}>
              <View style={styles.half}>
                {label(t.printPaper)}
                <Segmented label={t.printPaper} value={printOpts.paper} onChange={(paper) => opt({ paper })}
                  options={[{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }]} />
              </View>
              <View style={styles.half}>
                {label(t.printSize)}
                <Segmented label={t.printSize} value={printOpts.size} onChange={(size) => opt({ size })}
                  options={([['S', 13, t.printSizes[0]], ['M', 17, t.printSizes[1]], ['L', 22, t.printSizes[2]]] as const).map(([value, size, name]) => ({ value, label: name, icon: (c: string) => <Glyph text="A" size={size} color={c} /> }))} />
              </View>
            </View>

            {label(t.printColor)}
            <Segmented label={t.printColor} value={printOpts.color ? 'red' : 'bw'} onChange={(v) => opt({ color: v === 'red' })}
              options={[{ value: 'red', label: t.printRed }, { value: 'bw', label: t.printBw }]} />

            {error && <Text style={[styles.error, { color: colors.crimson }, right]}>{t.printFailed}</Text>}
          </ScrollView>

          <View style={[styles.actions, { flexDirection: row }]}>
            {SAVES_FILE && canPrint() && (
              <ActionButton icon="print" text={t.print} busy={busy === 'print'} disabled={!!busy} onPress={() => run('print')} />
            )}
            <ActionButton primary icon={SAVES_FILE ? 'share' : 'print'} text={SAVES_FILE ? t.savePdf : t.printAction} busy={busy === 'pdf'} disabled={!!busy} onPress={() => run('pdf')} />
          </View>
          {!SAVES_FILE && <Text style={[styles.hint, { color: colors.label2 }]}>{t.printWebHint}</Text>}
          {busy && <Text style={[styles.hint, { color: colors.label2 }]}>{t.preparing}</Text>}
        </View>
      </View>
    </Modal>
  );
}

function ActionButton({ icon, text, onPress, primary, busy, disabled }: {
  icon: 'print' | 'share'; text: string; onPress: () => void; primary?: boolean; busy?: boolean; disabled?: boolean;
}) {
  const { colors, dark } = useSettings();
  // The night crimson is light: dark letters on it read better than white.
  const fg = primary ? (dark ? colors.bg : '#FFFFFF') : colors.crimson;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: primary ? colors.crimson : colors.tint }, primary && styles.actionPrimary, (pressed || (disabled && !busy)) && styles.dim]}>
      {busy ? <ActivityIndicator color={fg} /> : <Icon name={icon} size={19} color={fg} strokeWidth={2} />}
      <Text numberOfLines={1} style={[styles.actionText, { color: fg }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  wrapWide: { justifyContent: 'center', alignItems: 'center' },
  scrim: { backgroundColor: 'rgba(10,6,8,0.38)' },
  card: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 },
  head: { alignItems: 'center', gap: 10, marginBottom: 6 },
  headIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 19, fontWeight: '700' },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  body: { paddingBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  group: { borderRadius: 16, overflow: 'hidden' },
  option: { alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  optionSub: { fontSize: 13, marginTop: 1 },
  pairRow: { gap: 12 },
  half: { flex: 1 },
  error: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  actions: { gap: 10, marginTop: 16 },
  action: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  actionPrimary: { flex: 1.4 },
  actionText: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  hint: { fontSize: 12.5, textAlign: 'center', marginTop: 8 },
  dim: { opacity: 0.6 },
  right: { textAlign: 'right', writingDirection: 'rtl' },
});
