import { Mark, mergeAttributes } from '@tiptap/core';

export interface ClaimOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    claim: {
      /**
       * Set a claim mark
       */
      setClaim: () => ReturnType;
      /**
       * Toggle a claim mark
       */
      toggleClaim: () => ReturnType;
      /**
       * Unset a claim mark
       */
      unsetClaim: () => ReturnType;
    };
  }
}

export const ClaimExtension = Mark.create<ClaimOptions>({
  name: 'claim',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'knowledge-claim',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[class="knowledge-claim"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setClaim: () => ({ commands }) => {
        return commands.setMark(this.name);
      },
      toggleClaim: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
      unsetClaim: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});
