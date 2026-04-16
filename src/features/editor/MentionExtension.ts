import { Mark, mergeAttributes } from '@tiptap/core';

export interface MentionOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      /**
       * Set a mention mark
       */
      setMention: (attributes: { entityId: string, entityName: string }) => ReturnType;
      /**
       * Toggle a mention mark
       */
      toggleMention: (attributes: { entityId: string, entityName: string }) => ReturnType;
      /**
       * Unset a mention mark
       */
      unsetMention: () => ReturnType;
    };
  }
}

export const MentionExtension = Mark.create<MentionOptions>({
  name: 'mention',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'entity-mention',
      },
    };
  },

  addAttributes() {
    return {
      entityId: {
        default: null,
        parseHTML: element => element.getAttribute('data-entity-id'),
        renderHTML: attributes => {
          return {
            'data-entity-id': attributes.entityId,
          };
        },
      },
      entityName: {
        default: null,
        parseHTML: element => element.getAttribute('data-entity-name'),
        renderHTML: attributes => {
          return {
            'data-entity-name': attributes.entityName,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-entity-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setMention: attributes => ({ commands }) => {
        return commands.setMark(this.name, attributes);
      },
      toggleMention: attributes => ({ commands }) => {
        return commands.toggleMark(this.name, attributes);
      },
      unsetMention: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});
