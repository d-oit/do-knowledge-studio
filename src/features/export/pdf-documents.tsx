/**
 * React-PDF document components used by pdf-exporter.
 * Kept in a separate file from pdf-exporter.tsx so the latter can export
 * only non-component functions and satisfy react-refresh's
 * "only-export-components" rule.
 */
import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Entity, Note } from '../../lib/validation';
import { stripHtmlTags } from '../../lib/security';
import { pdfStyles } from './pdf-styles';

interface NoteDocumentProps {
  note: Note;
  entityName?: string;
}

export function NoteDocument({ note, entityName }: NoteDocumentProps): React.ReactElement {
  return (
    <Document title={entityName ? `Note: ${entityName}` : 'Note'}>
      <Page size="A4" style={pdfStyles.page}>
        {entityName ? <Text style={pdfStyles.h1}>{stripHtmlTags(entityName)}</Text> : null}
        <Text style={pdfStyles.body}>{stripHtmlTags(note.content ?? '')}</Text>
        {note.format ? <Text style={pdfStyles.tag}>Format: {note.format}</Text> : null}
      </Page>
    </Document>
  );
}

interface NotesDocumentProps {
  notes: Note[];
  entities: Entity[];
  title?: string;
}

export function NotesDocument({ notes, entities, title }: NotesDocumentProps): React.ReactElement {
  const entityNameById = new Map(entities.filter(e => e.id).map(e => [e.id!, e.name]));
  return (
    <Document title={title ?? 'Knowledge Base'}>
      <Page size="A4" style={pdfStyles.cover}>
        <Text style={pdfStyles.coverTitle}>{title ?? 'Knowledge Base Export'}</Text>
        <Text style={pdfStyles.coverSubtitle}>
          {notes.length} note{notes.length === 1 ? '' : 's'} · {new Date().toLocaleDateString()}
        </Text>
      </Page>
      {notes.length > 0 ? (
        <Page size="A4" style={pdfStyles.page}>
          <Text style={pdfStyles.h1}>Table of Contents</Text>
          {notes.map((note, i) => (
            <View key={note.id ?? i} style={pdfStyles.tocItem}>
              <Text>{i + 1}. {stripHtmlTags(entityNameById.get(note.entity_id ?? '') ?? 'Untitled')}</Text>
              <Text>{note.format}</Text>
            </View>
          ))}
        </Page>
      ) : null}
      {notes.map((note, i) => (
        <Page key={note.id ?? i} size="A4" style={pdfStyles.page} wrap>
          <Text style={pdfStyles.meta}>Note {i + 1} of {notes.length}</Text>
          <Text style={pdfStyles.h2}>
            {stripHtmlTags(entityNameById.get(note.entity_id ?? '') ?? 'Untitled')}
          </Text>
          <Text style={pdfStyles.body}>{stripHtmlTags(note.content ?? '')}</Text>
        </Page>
      ))}
    </Document>
  );
}
