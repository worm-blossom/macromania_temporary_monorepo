import { expandEmbeddedImportMap } from "https://deno.land/x/esbuild_deno_loader@0.9.0/src/shared.ts";
import {
  Def,
  dependencyCss,
  dependencyJs,
  Div,
  Indent,
  Loc,
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
import { SpliceLoc } from "../mod.tsx";

const l = createLogger("LoggerStructuredcode");
const ConfigMacro = l.ConfigMacro;
export { ConfigMacro as LoggerStructuredcode };

/**
 * Three different styles of rendering delimiters.
 *
 * `c` renders C-style delimiters. `python` omits curly braces. `ruby` uses keywords instead of punctuation.
 */
export type DelimiterStyle = "c" | "python" | "ruby";

export type StructuredcodeConfig = {
  /**
   * How many colors to cycle through for the rainbow delimiters.
   * Defaults to three.
   */
  colorsOfTheRainbow?: number;
  /**
   * Which delimiter style to use. Defaults to python-style delimiters.
   */
  delimiterStyle?: DelimiterStyle;
};

const [
  getStructuredcodeConfig,
  ConfigStructuredcode,
] = createConfigOptions<StructuredcodeConfig, StructuredcodeConfig>(
  "ConfigStructuredcode",
  () => ({
    colorsOfTheRainbow: 3,
    delimiterStyle: "python",
  }),
  (oldValue, update) => {
    const newValue = { ...oldValue };
    if (update.colorsOfTheRainbow !== undefined) {
      newValue.colorsOfTheRainbow = update.colorsOfTheRainbow;
    }
    if (update.delimiterStyle !== undefined) {
      newValue.delimiterStyle = update.delimiterStyle;
    }

    return newValue;
  },
);
export { ConfigStructuredcode };

type StructuredcodeState = {
  rainbowCount: number;
};

const [getStructuredcodeState, setStructuredcodeState] = createSubstate<
  StructuredcodeState
>(
  () => ({
    rainbowCount: 0,
  }),
);

export type DelimiterProps = {
  /**
   * The opening and the closing delimiter.
   */
  delims: [Expressions, Expressions];
  /**
   * Exclude the delimiters from rainbowowing, i.e., do not color them according to nesting depth.
   */
  noRainbow?: boolean;
  /**
   * The content to wrap in the delimiters.
   */
  children?: Expressions;
};

/**
 * Wrap the children between two delimiters.
 */
export function Delimiters(
  { delims, children, noRainbow }: DelimiterProps,
): Expression {
  if (noRainbow) {
    return (
      <>
        <Span clazz={["open"]}>
          <exps x={delims[0]} />
        </Span>
        <exps x={children} />
        <Span clazz={["close"]}>
          <exps x={delims[1]} />
        </Span>
      </>
    );
  }

  return (
    <lifecycle
      pre={(ctx) => {
        const state = getStructuredcodeState(ctx);
        const config = getStructuredcodeConfig(ctx);

        state.rainbowCount = (state.rainbowCount + 1) %
          config.colorsOfTheRainbow!;
      }}
      post={(ctx) => {
        const state = getStructuredcodeState(ctx);
        const config = getStructuredcodeConfig(ctx);

        state.rainbowCount = (state.rainbowCount - 1) %
          config.colorsOfTheRainbow!;
      }}
    >
      <impure
        fun={(ctx) => {
          const state = getStructuredcodeState(ctx);

          const clazz = `rb${state.rainbowCount}`;

          return (
            <>
              <Span clazz={[clazz, "open"]}>
                <exps x={delims[0]} />
              </Span>
              <exps x={children} />
              <Span clazz={[clazz, "close"]}>
                <exps x={delims[1]} />
              </Span>
            </>
          );
        }}
      />
    </lifecycle>
  );
}

/**
 * Information to render delimiters in all supported `DelimiterStyle`s.
 */
export type ConfigurableDelimiters = {
  /**
   * The default delimiters, as rendered in C-style pseudocode.
   */
  c: [Expressions, Expressions];
  /**
   * Whether to omit these delimiters in Python-style pseudocode.
   * Defaults to false.
   */
  pythonSkip?: boolean;
  /**
   * Alternate delimiters to use in Ruby-style pseudocode.
   * Defaults to undefined, rendering the same as in c, even for ruby.
   */
  ruby?: [Expression, Expression];
};

/**
 * Props for the `Delimited` macro.
 */
export type DelimitedProps = ConfigurableDelimiters & {
  /**
   * The code to place between the delimiters.
   */
  content: Expressions[];
  /**
   * Render the content Expressions in their own line each, or within a single, shared line of code.
   */
  multiline?: boolean;
  /**
   * Optional separator to place between the content Expressions.
   */
  separator?: Expressions;
  /**
   * Exclude the delimiters from rainbowowing, i.e., do not color them according to nesting depth.
   */
  noRainbow?: boolean;
};

/**
 * Render some content Expressions: wrapped in configurable delimiters,
 * optionally separated, and optionally rendered in their own line each.
 */
export function Delimited(
  { content, multiline, separator, c, pythonSkip, ruby, noRainbow }: DelimitedProps,
): Expression {
  return (
    <impure
      fun={(ctx) => {
        const config = getStructuredcodeConfig(ctx);
        const style = config.delimiterStyle;

        let open = c[0];
        let close = c[1];

        if (style === "ruby" && ruby !== undefined) {
          open = ruby[0];
          close = ruby[1];

          if (!multiline) {
            open = <>{ruby[0]} </>;
          }
        }

        const noDelims = multiline && (style === "python") && pythonSkip;

        const separatedContent: Expressions = [];
        for (let i = 0; i < content.length; i++) {
          const exps = content[i];
          const addSeparator = (separator !== undefined) &&
            (multiline || (i + 1 < content.length));

          if (addSeparator) {
            separatedContent.push(
              <>
                <exps x={exps} />
                <Deemph><exps x={separator} /></Deemph>
                {multiline ? "" : " "}
              </>,
            );
          } else {
            if (!multiline && style === "ruby" && ruby !== undefined) {
              separatedContent.push(<><exps x={exps} />{" "}</>);
            } else {
              separatedContent.push(<exps x={exps} />);
            }
          }
        }

        const betweenDelimiters = multiline
        ? (
          <SpliceLoc>
            <Indent>
              <exps
                x={separatedContent.map((exp) => <Loc>{exp}</Loc>)}
              />
            </Indent>
          </SpliceLoc>
        )
        : <exps x={separatedContent} />;

        return noDelims ? betweenDelimiters : <Delimiters delims={[open, close]} noRainbow={noRainbow}>{betweenDelimiters}</Delimiters>;
      }}
    />
  );
}

/**
 * Render a full-line comment.
 * Provides its own `<Loc>` invocation.
 */
export function DocComment({children}: {children?: Expressions}): Expression {
  return <Loc><Div clazz="docComment"><exps x={children}/></Div></Loc>
}

/**
 * Render a keyword.
 */
export function Keyword(
  { children }: { children: Expressions },
): Expression {
  return <Span clazz="kw"><exps x={children}/></Span>;
}

/**
 * Visually deemphasize a part of some pseudocode. 
 */
export function Deemph(
  { children }: { children: Expressions },
): Expression {
  return <Span clazz="deemph"><exps x={children}/></Span>;
}
