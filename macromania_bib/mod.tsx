import {
  Def,
  dependencyCss,
  dependencyJs,
  Div,
  PreviewScope,
  R,
} from "../mod.tsx";
import { Config } from "./deps.ts";
import { createConfigOptions } from "./deps.ts";
import {
  CiteJs,
  Context,
  createLogger,
  createSubstate,
  CSL,
  Expression,
  Expressions,
} from "./deps.ts";

import defaultStyle from "./styles/din-1505-2.csl.json" with { type: "json" };
import locales from "./locales.json" with { type: "json" };

const l = createLogger("LoggerBib");
const ConfigMacro = l.ConfigMacro;
export { ConfigMacro as LoggerBib };

/**
 * Okay, this citation business is more complicated than one might assume. Our state management is informed by
 * the demands of the citeproc-js APIs.
 *
 * Users place `<BibScope>` macros to create scopes that handle citations fully independently from all other
 * bibscopes. The cannot be nested. The `ScopeState` is the state we have to track per bibscope.
 *
 * Citations cannot be rendered immediately when encountering a macro that adds them. For the most accurate
 * citing styles, we want to first collect all citations that happen in a bibscope, and then render them once
 * we have all of them. Unfortunately, we cannot raelly know when we have everything, so we stay in the phase of
 * collecting information without rendering as long as possible.
 */
type ScopeState = {
  /**
   * Are we still collecting information (true), or do we proceed with rendering citations (false)?
   */
  stillCollecting: boolean;
  /**
   * Each time a macro creates a citation, we track that citation in an array. As long as the citation-adding macros
   * are processed in the order in which they appear in the rendered document, the array ordering will accurately
   * reflect that order. It is this order that we present to citeproc-js as the order of the references. If macros
   * are evaluated in an order diverging from their position in the text, citation rendering will be inaccurate (for
   * styles that *care* about ordering, that is).
   */
  citations: CitationState[];
  /**
   * The citeproc CSL.Engine to use for this bibscope.
   */
  citeproc: unknown;
};

/**
 * The state we track for each citation in the bibscope.
 */
type CitationState = {
  /**
   * The citation object to pass to citeproc-js.
   */
  citation: Citation;
  /**
   * The rendered citation to put into the document.
   * Starts out with a dummy value (`"[?]"`).
   */
  rendered: string;
};

/**
 * A citation object to pass to citeproc-js.
 *
 * See https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html#citations
 */
type Citation = {
  citationID: string; // A unique id (within a bibscope) that identifies this particular Citation.
  citationItems: CitationItem[];
  properties: {
    /**
     * Indicates the footnote number in which the citation is located within the document. Citations within the main text of the document have a noteIndex of zero.
     */
    noteIndex: number;
  };
};

/**
 * Cite-items describe a specific reference to a bibliographic item. The fields that a cite-item may contain depend on its context. In a citation, cite-items listed as part of the citationItems array provide only pinpoint, descriptive, and text-suppression fields:
 */
type CitationItem = {
  // No idea what this is or which contracts it must uphold. The citeproc docs are not the best =/
  // We'll just make them bibscope-unique and unchanging and hope that works.
  id: string;
  /**
   * String identifying a page number or other pinpoint location or range within the resource.
   */
  locator?: number;
  /**
   * A  label type, indicating whether the locator is to a page, a chapter, or other subdivision of the target resource. Valid labels are defined in the CSL specification: https://docs.citationstyles.org/en/stable/specification.html
   */
  label?: string;
  /**
   * A string to print before this cite item.
   */
  prefix?: string;
  /**
   * A  string to print after this cite item.
   */
  suffix?: string;
  /**
   * If true, author names will not be included in the citation output for this cite.
   */
  "suppress-author"?: boolean;
  /**
   * If true, only the author name will be included in the citation output for this cite – this optional parameter provides a means for certain demanding styles that require the processor output to be divided between the main text and a footnote.
   */
  "author-only"?: boolean;
  /**
   * An integer flag that indicates whether the cite item should be rendered as a first reference, an immediately-following reference (i.e. ibid), an immediately-following reference with locator information, or a subsequent reference.
   */
  position?: number;
  /**
   * A boolean flag indicating whether another reference to this resource can be found within a specific number of notes, counting back from the current position. What is “near” in this sense is style-dependent.
   */
  "near-note"?: boolean;
};

const [getState, setState] = createSubstate<null | ScopeState>(
  () => null,
);

export type BibScopeProps = {
  /**
   * CSL style as serialized xml.
   */
  style?: string;
  /**
   * A language tag to select the locale. Defaults to "en-US".
   */
  lang?: string;
  /**
   * Whether the `lang` prop should overwrite the default locale of the `style`.
   */
  forceLang?: boolean;
  /**
   * The items that can be cited in this bibscope.
   */
  items: BibItemDeclaration[];
  /**
   * Macros to render inside the bibscope.
   */
  children?: Expressions;
};

/**
 * An item to cite, optionally with a hyperlink or an asset path to retrieve that item.
 */
export type BibItemDeclaration = {
  /**
   * A url at which to find the item. All citations of this item will link to this.
   */
  href?: string;
  /**
   * If the cited item is in the asset directory, specify its asset path here.
   *
   * If this is present, `href` will be ignored.
   */
  asset?: string[];
  /**
   * The item to cite, as a javascript object conforming to the [CSL-JSON documentation](https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html#items), or as a string of BibTex.
   */
  item: BibItem | string;
  /**
   * Should the item be included in the bibliography even if it does not get cited? Defaults to false.
   */
  includeEvenIfNotCited?: boolean;
};

/**
 * Same as BibItemDeclaration, except the `item` must be a BibItem.
 */
type ItemDeclaration = {
  href?: string;
  asset?: string[];
  item: BibItem;
  includeEvenIfNotCited?: boolean;
};

/**
 * An item is a single bundle of metadata for a source to be referenced. See the [CSL Specification](https://docs.citationstyles.org/en/stable/specification.html) for details on the fields available on an item, and the [CSL-JSON docs](https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html) for the format of specific field types. Every item must have an id and a type.
 */
export interface BibItem {
  /**
   * The id field is a simple field containing any string or numeric value. The value of the ID field must uniquely identify the item, as this field is used to retrieve items by their ID value.
   */
  id: string | number;
  /**
   * The type field is a simple field containing a string value. CSL-JSON constrains the possible for values of the type field to a limited set of possible values (e.g., “book” or “article”). The type must be a valid CSL type under the schema of the installed style. See the schemata of [CSL](https://github.com/citation-style-language/schema/blob/master/csl-types.rnc) and [CSL-M](https://github.com/Juris-M/schema/blob/master/csl-mlz.rnc#L763) for their respective lists of valid types.
   */
  type: string;
}

export function BibScope(
  { style = defaultStyle, lang = "en-Us", forceLang = false, items, children }:
    BibScopeProps,
): Expression {
  return (
    <impure
      fun={(ctx) => {
        // Impure so we can do logging.

        const itemMap: Map<string, ItemDeclaration> = new Map();

        for (const itemDeclaration of items) {
          let actualItem: BibItem;

          if (typeof itemDeclaration.item === "string") {
            try {
              const citeJs = new CiteJs(itemDeclaration.item, {
                forceType: "@bibtex/text",
              });

              const parsed = citeJs.format("data", {
                format: "object",
              }) as BibItem;
              actualItem = parsed;
            } catch (err) {
              l.warn(ctx, `Error parsing bibtex input:`);
              l.at(ctx);
              l.warn(ctx, err);
              continue;
            }
          } else {
            actualItem = itemDeclaration.item;
          }

          const decl = {
            href: itemDeclaration.href,
            asset: itemDeclaration.asset,
            includeEvenIfNotCited: itemDeclaration.includeEvenIfNotCited,
            item: actualItem,
          };

          itemMap.set(`${actualItem.id}`, decl);
        }

        const citeproc = new CSL.Engine(
          {
            retrieveLocale: (localeId: string) => {
              if (localeId === "us") {
                return locales["en-US"];
              } else {
                return (locales as Record<string, unknown>)[localeId];
              }
            },
            retrieveItem: (itemId: string | number) => {
              return itemMap.get(`${itemId}`);
            },
          },
          style,
          lang,
          forceLang,
        );

        const myState: ScopeState = {
          stillCollecting: true,
          citations: [],
          citeproc,
        };

        // Lifecycle to set up an isolated state for this bibscope.
        return (
          <lifecycle
            pre={(ctx) => {
              const state = getState(ctx);
              if (state !== null) {
                l.error(ctx, "Must not nest BibScopes.");
                return ctx.halt();
              }

              setState(ctx, myState);
            }}
            post={(ctx) => {
              setState(ctx, null);
            }}
          >
            <exps x={children} />
          </lifecycle>
        );
      }}
    />
  );
}
