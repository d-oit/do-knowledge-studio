import { Extension } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export const BlockIdExtension = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'listItem'],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-block-id'),
            renderHTML: attributes => {
              if (!attributes.id) {
                return {};
              }

              return {
                'data-block-id': attributes.id,
              };
            },
          },
        },
      },
    ];
  },

  addStorage() {
    return {
      lastDoc: null,
    };
  },

  appendTransaction([transaction], oldState, newState) {
    if (!transaction.docChanged) return null;

    const { tr } = newState;
    let modified = false;

    newState.doc.descendants((node, pos) => {
      if (['paragraph', 'heading', 'listItem'].includes(node.type.name) && !node.attrs.id) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id: uuidv4(),
        });
        modified = true;
      }
      return true;
    });

    return modified ? tr : null;
  },
});
