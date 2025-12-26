import { Extension } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";

export const FontSizeExtension = Extension.create({
  name: "fontSize",

  addExtensions() {
    return [TextStyle];
  },

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]/g, "") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});
