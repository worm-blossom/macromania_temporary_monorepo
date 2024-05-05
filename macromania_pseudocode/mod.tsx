import {
  Def,
  dependencyCss,
  dependencyJs,
  Div,
  PreviewScope,
  R,
} from "../mod.tsx";
import {
  Code,
  Config,
  ConfigWebserverRoot,
  Li,
  Ol,
  Span,
  styleAssetPath,
} from "./deps.ts";
import {
  absoluteOutFsPath,
  Cd,
  createConfigOptions,
  ScriptDependencyInfo,
  StylesheetDependencyInfo,
  TagProps,
} from "./deps.ts";
import {
  Colors,
  Context,
  createLogger,
  createSubstate,
  Expression,
  Expressions,
  File,
  Html5,
} from "./deps.ts";

const l = createLogger("LoggerPseudocode");
const ConfigMacro = l.ConfigMacro;
export { ConfigMacro as LoggerPseudocode };

export type PseudocodeConfig = {
  /**
   * Whether to render line numbers. Defaults to `false`.
   */
  lineNumbering?: boolean;
  /**
   * Css dependencies to add to all pages with a `Pseudocode` macro.
   */
  cssDeps?: StylesheetDependencyInfo[];
  /**
   * JavaScript dependencies to add to all pages with a `Pseudocode` macro.
   */
  jsDeps?: ScriptDependencyInfo[];
};

const [
  getPseudocodeConfig,
  ConfigPseudocode,
] = createConfigOptions<PseudocodeConfig, PseudocodeConfig>(
  "ConfigPreviews",
  () => ({
    lineNumbering: false,
    cssDeps: [],
    jsDeps: [],
  }),
  (oldValue, update) => {
    const newValue = { ...oldValue };
    if (update.lineNumbering !== undefined) {
      newValue.lineNumbering = update.lineNumbering;
    }
    if (update.cssDeps !== undefined) {
      newValue.cssDeps = update.cssDeps;
    }
    if (update.jsDeps !== undefined) {
      newValue.jsDeps = update.jsDeps;
    }

    return newValue;
  },
);
export { ConfigPseudocode };

type PeudocodeState = {
  lineNumber: number;
  indentation: number;
  showLineNumbers: boolean;
  n: string;
};

const [getPseudocodeState, setPseudocodeState] = createSubstate<PeudocodeState>(
  () => ({
    lineNumber: 1,
    indentation: 0,
    showLineNumbers: false, // Initial value is ignored, this is overwritten by every Pseudocode macro.
    n: "",
  }),
);

export type PseudocodeProps = {
  /**
   * A unique name to refer to this codeblock via DefRef.
   * Also gets used as an html id.
   */
  n: string;
  /**
   * Whether to show line numbers or not. If `undefined`, defers to the `lineNumbering` config option,
   * which defaults to *not* showing line numbers.
   */
  lineNumbering?: boolean;
  /**
   * If `true`, this code block will not number its lines form 1, but instead continue where the previous block left off.
   */
  noLineNumberReset?: boolean;
  /**
   * The lines of could. Must be (directly or indirectly) an alternating sequence of `<StartLoc/>` and `<EndLoc/>` macros,
   * with the code to render in-between them.
   */
  children?: Expressions;
};

/**
 * Create a block of pseudocode.
 *
 * The children of this should all use the `<Loc/>` macro (directly or indirectly)
 * for the output to render sensibly.
 */
export function Pseudocode(
  { children, n, lineNumbering, noLineNumberReset }: PseudocodeProps,
): Expression {
  return (
    <impure
      fun={(ctx) => {
        const config = getPseudocodeConfig(ctx);

        const doNumber = lineNumbering === undefined
          ? getPseudocodeConfig(ctx).lineNumbering!
          : lineNumbering;

        const state = getPseudocodeState(ctx);
        state.showLineNumbers = doNumber;

        if (!noLineNumberReset) {
          state.lineNumber = 1;
        }

        state.n = n;

        return (
          <PreviewScope>
            <omnomnom>
              <Def n={n} noHighlight refData={{pseudocode: n}} />
            </omnomnom>
            <impure
              fun={(ctx) => {
                for (const dep of config.cssDeps ?? []) {
                  dependencyCss(ctx, dep);
                }
                for (const dep of config.jsDeps ?? []) {
                  dependencyJs(ctx, dep);
                }
                return "";
              }}
            />
            <Code
              id={n}
              clazz={`pseudocode${
                state.showLineNumbers ? "" : " noLineNumbers"
              }`}
            >
              <exps x={children} />
            </Code>
          </PreviewScope>
        );
      }}
    />
  );
}

/**
 * Begin a new line of code. It has to be closed with the `<EndLoc/>` macro.
 */
function StartLoc(): Expression {
  return (
    <impure
      fun={(ctx) => {
        const state = getPseudocodeState(ctx);

        const gutter = (
          <Div
            clazz="locGutter"
            id={lineId(state.n, state.lineNumber)}
            data={{ l: `${state.lineNumber}`, i: `${state.indentation}` }}
          >
            <Div clazz="lineNumber">
              <RefLoc n={state.n} lines={state.lineNumber} noPreview>
                {`${state.lineNumber}`}
              </RefLoc>
            </Div>
            <Div clazz="fold" />
          </Div>
        );
        state.lineNumber += 1;

        const indents: Expression[] = [];
        for (let i = 0; i < state.indentation; i++) {
          indents.push(<Div clazz="indent">&nbsp;</Div>);
        }

        return (
          <>
            {gutter}
            {`<div class="locContent">`}
            <exps x={indents} />
          </>
        );
      }}
    />
  );
}

/**
 * Terminate a line of code that was opened with the `<StartLoc/>` macro.
 */
function EndLoc(): Expression {
  return `</div>`;
}

/**
 * Create a self-contained line of code in a `Pseudocode` block.
 */
export function Loc({ children }: { children?: Expressions }): Expression {
  return (
    <>
      <StartLoc />
      <exps x={children} />
      <EndLoc />
    </>
  );
}

/**
 * Splice up a `<Loc>`, allowing you to add new lines "inside".
 * Everything up to this macro becomes a line, and everything after this macro becomes a line.
 */
export function SpliceLoc(
  { children }: { children?: Expressions },
): Expression {
  return (
    <>
      <EndLoc />
      <exps x={children} />
      <StartLoc />
    </>
  );
}

/**
 * Increment the level of indentation of all lines of code within this macro.
 */
export function Indent({ children }: { children?: Expressions }): Expression {
  return (
    <lifecycle
      pre={(ctx) => {
        const state = getPseudocodeState(ctx);
        state.indentation += 1;
      }}
      post={(ctx) => {
        const state = getPseudocodeState(ctx);
        state.indentation -= 1;
      }}
    >
      <exps x={children} />
    </lifecycle>
  );
}

/**
 * The different ways of specifying lines of code to highlight: a single line, a range of lines (both ends inclusive), and a sequenece of any of the prior.
 */
export type Lines = number | [number, number] | {
  many: (number | [number, number])[];
};

function linesValidateAndFindFirst(ctx: Context, lines: Lines): number {
  if (typeof lines === "number") {
    return lines;
  } else if (Array.isArray(lines)) {
    if (lines[0] > lines[1]) {
      l.error(
        ctx,
        `In a range of lines, the second line must be greater than or equal to the first line, but got [${
          lines[0]
        }, ${lines[1]}]`,
      );
      ctx.halt();
      return -1; // never reached, `ctx.halt()` throws. But the compiler doesn't know that.
    } else {
      return lines[0];
    }
  } else {
    const theLines = lines.many;

    if (theLines.length === 0) {
      l.error(ctx, `Must highlight at least one line`);
      ctx.halt();
    }

    let min = Infinity;
    for (const innerLines of theLines) {
      min = Math.min(min, linesValidateAndFindFirst(ctx, innerLines));
    }

    return min;
  }
}

/**
 * Encode lines as a string that can be used as a url parameter.
 * The encoding is simple: if there are many lines, separate them with `a` characters.
 * Encode an individual line as a decimal int, and a sequence as two decimal ints, separated by the `b` character.
 */
function encodeLines(lines: Lines): string {
  if (typeof lines === "number") {
    return `${lines}`;
  } else if (Array.isArray(lines)) {
    return `${lines[0]}b${lines[1]}`;
  } else {
    const innerEncoded = lines.many.map(encodeLines);
    return innerEncoded.join("a");
  }
}

export type RefLocProps = {
  /**
   * The code block to reference.
   */
  n: string;
  /**
   * The line(s) of code to reference.
   */
  lines: Lines;
  /**
   * If true, do not show a preview when hovering over the reference.
   */
  noPreview?: boolean;
  /**
   * The text to render as the reference.
   * Must be supplied.
   */
  children: Expressions;
};

/**
 * Reference specific lines of code.
 */
export function RefLoc(
  { children, n, lines, noPreview }: RefLocProps,
): Expression {
  return (
    <impure
      fun={(ctx) => {
        const firstLine = linesValidateAndFindFirst(ctx, lines);
        const encodedLines = encodeLines(lines);
        const paramString: [string, string] = ["hlLines", encodedLines];

        return (
          <R
            n={n}
            replacementId={lineId(n, firstLine)}
            queryParams={[paramString, ["hlPseudocode", n]]}
            noPreview={noPreview}
            extraData={{hllines: encodedLines}}
          >
            <exps x={children} />
          </R>
        );
      }}
    />
  );
}

function lineId(n: string, line: number): string {
  return `${n}L${line}`;
}
