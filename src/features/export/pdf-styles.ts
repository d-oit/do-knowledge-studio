/**
 * Shared React-PDF styles used by the document components.
 * Extracted into its own module so pdf-documents.tsx can remain an
 * "only-components" file for react-refresh compliance.
 */
import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.6 },
  h1: { fontSize: 20, marginTop: 16, marginBottom: 8, fontWeight: 'bold' },
  h2: { fontSize: 16, marginTop: 12, marginBottom: 6, fontWeight: 'bold' },
  body: { fontSize: 11, lineHeight: 1.6, marginBottom: 8 },
  tag: { fontSize: 9, color: '#666', marginTop: 8 },
  meta: { fontSize: 9, color: '#888', marginBottom: 4 },
  cover: {
    padding: 40,
    fontFamily: 'Helvetica',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  coverTitle: { fontSize: 32, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  coverSubtitle: { fontSize: 12, color: '#666', textAlign: 'center' },
  tocItem: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 },
});
