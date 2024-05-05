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
  "ConfigPreviews",
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
   * The content to wrap in the delimiters.
   */
  children?: Expressions;
};

/**
 * Wrap the children between two delimiters.
 */
export function Delimiters(
  { delims, children }: DelimiterProps,
): Expression {
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
};

/**
 * Render some content Expressions: wrapped in configurable delimiters,
 * optionally separated, and optionally rendered in their own line each.
 */
export function Delimited(
  { content, multiline, separator, c, pythonSkip, ruby }: DelimitedProps,
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
                <exps x={separator} />
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

        return noDelims ? betweenDelimiters : <Delimiters delims={[open, close]}>{betweenDelimiters}</Delimiters>;
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

// export type PseudocodeConfig = {
//   /**
//    * Whether to use indentation only ("pythonic") or curly braces "scenic" to delimit blocks.
//    *
//    * Defaults to "pythonic".
//    */
//   blockstyle: "pythonic" | "scenic";
// };

// const [
//   getConfig,
//   ConfigPseudocode,
// ] = createConfigOptions<PseudocodeConfig, PseudocodeConfig>(
//   "ConfigPreviews",
//   () => ({
//     blockstyle: "pythonic",
//   }),
//   (oldValue, update) => {
//     const newValue = { ...oldValue };
//     if (update.blockstyle !== undefined) {
//       newValue.blockstyle = update.blockstyle;
//     }

//     return newValue;
//   },
// );
// export { ConfigPseudocode };

// /**
//  * `Expression` turns into a single line of code, `Code[]` into an indented block.
//  * The `previewed` object creates a preview scope containing its `code`, mapped through the `wrapWith` function.
//  */
// export type Code = Expression | Code[] | {
//   previewed: {
//     code: Code;
//     wrapWith: (ctx: Context, exp: Expression) => Expression;
//   };
// };

// function renderLoc(
//   exp: Expression,
//   lineNumber: number,
//   indentation: number,
//   isFirstLineOfBlock: boolean[], // one entry for each level of indentation
//   isFinalLineOfBlock: boolean[], // one entry for each level of indentation
// ): Expression {
//   const indentTags: Expression[] = [];

//   for (let i = 0; i < indentation; i++) {
//     const clazz = ["indentation"];
//     if (isFirstLineOfBlock[i]) {
//       clazz.push("first");
//     }
//     if (isFinalLineOfBlock[i]) {
//       clazz.push("final");
//     }
//     indentTags.push(<Span clazz={clazz} />);
//   }

//   return (
//     <Li>
//       <Span clazz="lineNumber" data={{ loc: `${lineNumber}` }}>
//         {`${lineNumber}`}
//       </Span>
//       <Span clazz="indentationContainer" children={indentTags} />
//       <Span>{exp}</Span>
//     </Li>
//   );
// }

// type RenderState = {
//   /* expression per line of code */
//   linesSoFar: Expression[];
//   lineNumber: { number: number };
//   indentation: { number: number };
//   isFirstLineOfBlock: boolean[];
//   isFinalLineOfBlock: boolean[];
//   previews: PreviewCreation[];
// };

// type PreviewCreation = {
//   startLine: number; // inclusive
//   endLine: number; // exclusive
//   wrapWith: (ctx: Context, exp: Expression) => Expression;
// };

// function renderCode(
//   code: Code,
//   renderState: RenderState,
// ) {
//   const {
//     linesSoFar,
//     lineNumber,
//     indentation,
//     isFirstLineOfBlock,
//     isFinalLineOfBlock,
//     previews,
//   } = renderState;

//   if (Array.isArray(code)) {
//     indentation.number += 1;

//     for (let i = 0; i < code.length; i++) {
//       lineNumber.number += 1;
//       renderCode(code[i], {
//         linesSoFar,
//         lineNumber,
//         indentation,
//         isFirstLineOfBlock: [
//           ...isFirstLineOfBlock,
//           i === 0,
//         ],
//         isFinalLineOfBlock: [...isFinalLineOfBlock, i === code.length - 1],
//         previews,
//       });
//     }

//     indentation.number -= 1;
//   } else if (typeof code === "object" && "previewed" in code) {
//     const previewCreation: PreviewCreation = {
//       startLine: lineNumber.number,
//       endLine: -1,
//       wrapWith: code.previewed.wrapWith,
//     };

//     previews.push(previewCreation);

//     renderCode(code.previewed.code, renderState);

//     previewCreation.endLine = renderState.lineNumber.number;
//   } else {
//     const loc = renderLoc(
//       code,
//       lineNumber.number,
//       indentation.number,
//       isFirstLineOfBlock,
//       isFinalLineOfBlock,
//     );
//     linesSoFar.push(loc);
//   }
// }

// export type Item =
//   | Interface
//   | InterfaceImplementation
//   | TypeDef
//   | Struct
//   | Enum
//   | Const
//   | Procedure
//   | CodeComment;

// export type Interface = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeParams?: TypeParameterDef;
//   extending?: Code;
//   members: (InterfaceProcedure | InterfaceConst)[];
// };

// export type TypeParameterDef {
//   typeParams: TypeArgument[];
//   multiline?: boolean;
// }

// export type InterfaceProcedure = {
//   docComment?: Expression;
//   signature: FunctionSignature;
// };

// export type InterfaceConst = {
//   docComment?: Expression;
//   namedConst: TypedName;
// };

// export type TypeArgument = {
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   bounds?: TypeBound[];
//   multilineBounds?: boolean;
// };

// export type TypeBound = {
//   interfaceName: Expression;
//   interfaceParams?: Type[];
//   multilineInterfaceParams?: boolean;
// };

// export type FunctionSignature = {
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeParameters?: TypeParameterDef;
//   parameters?: TypedName[];
//   multilineParams?: boolean;
// };

// export type TypedName = {
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   type?: Type;
// };

// export type InterfaceImplementation = {
//   docComment?: Expression;
//   interfaceName: Expression;
//   implementor: Type;
//   members: (Procedure | Const)[];
// };

// export type TypeDef = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeParameters?: TypeParameterDef;
//   rhs: Type;
//   typeDef: true;
// };

// export type Struct = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeParameters?: TypeParameterDef;
//   fields: Field[];
// };

// export type Field = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   rhs: Type;
// };

// export type Enum = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeParameters?: TypeParameterDef;
//   variants: Struct[];
// };

// export type Const = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeAnnotation?: Type;
//   rhs: CodeExpression;
//   isConst: true;
// };

// export type Procedure = FunctionSignature & {
//   body: Statement[];
// };

// export type Type = TypeApplication | Code;

// export type TypeApplication = {
//   callee: Code;
//   parameters?: Type[];
//   multiline?: boolean;
// };

// export type CodeComment = {
//   comment: Expression;
// };

// export type Statement =
//   | Loop
//   | For
//   | While
//   | Let
//   | Var
//   | Assignment
//   | CodeComment
//   | CodeExpression
//   | Code;

// export type CodeExpression = If | Call | Code;

// export type Loop = {
//   loop: Statement[];
// };

// export type For = {
//   condition: CodeExpression;
//   loop: Statement[];
// };

// export type While = {
//   condition: CodeExpression;
//   loop: Statement[];
// };

// export type Let = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeAnnotation?: Type;
//   rhs: CodeExpression;
// };

// export type Var = {
//   docComment?: Expression;
//   /**
//    * For DefRef.
//    */
//   id: string;
//   name: Expression;
//   typeAnnotation?: Type;
//   rhs: CodeExpression;
// };

// export type Assignment = {
//   lhs: Expression;
//   rhs: CodeExpression;
// };

// export type If = {
//   condition: CodeExpression;
//   ifBlock: Statement[];
//   elseBlock?: Statement[];
//   ifElse?: If;
// };

// export type Call = {
//   fun: Code;
//   typeParameters?: Type[];
//   multilineTypeParameters?: boolean;
//   arguments?: CodeExpression[];
//   multilineArguments?: boolean;
// };

// export function Pseudocode({ items }: { items: Item[] }): Expression {
//   return (
//     <impure
//       fun={(ctx) => {
//         const renderState: RenderState = {
//           linesSoFar: [],
//           lineNumber: { number: 0 },
//           indentation: { number: 0 },
//           isFirstLineOfBlock: [],
//           isFinalLineOfBlock: [],
//           previews: [],
//         };

//         items.forEach((item) => renderItem(ctx, renderState, item));

//         const withPreviews = previewify(
//           renderState.linesSoFar,
//           renderState.previews,
//         );

//         return WrapInCode({ children: withPreviews });
//       }}
//     />
//   );
// }

// /**
//  * Take rendered lines and information about how to place preview scopes within them, then do exactly that.
//  */
// function previewify(
//   lines: Expression[],
//   previewInfos: PreviewCreation[],
// ): Expression {
//   if (previewInfos.length === 0) {
//     return <exps x={lines} />;
//   } else {
//     const info = previewInfos.shift()!;

//     const before = lines.slice(0, info.startLine);
//     const mid = lines.slice(info.startLine, info.endLine);
//     const after = lines.slice(info.endLine);

//     const recursivelyPreviewfied = previewify(mid, previewInfos);

//     return (
//       <WrapInCode>
//         <exps x={before} />
//         <map fun={(evaled, ctx) => addScope(evaled, ctx, info)}>
//           {recursivelyPreviewfied}
//         </map>
//         <exps x={after} />
//       </WrapInCode>
//     );
//   }

//   function addScope(
//     evaled: string,
//     ctx: Context,
//     info: PreviewCreation,
//   ): Expression {
//     return (
//       <>
//         <omnomnom>
//           <PreviewScope>
//             {info.wrapWith(ctx, evaled)}
//           </PreviewScope>
//         </omnomnom>
//         {evaled}
//       </>
//     );
//   }
// }

// function WrapInCode({ children }: { children?: Expressions }): Expression {
//   return (
//     <Code clazz="pseudocode">
//       <Ol children={children} />
//     </Code>
//   );
// }

// function itemIsInterface(item: Item): item is Interface {
//   return "extending" in item;
// }

// function itemIsInterfaceImplementation(
//   item: Item,
// ): item is InterfaceImplementation {
//   return "interfaceName" in item;
// }

// function itemIsTypeDef(item: Item): item is TypeDef {
//   return "typeDef" in item;
// }

// function itemIsStruct(item: Item): item is Struct {
//   return "fields" in item;
// }

// function itemIsEnum(item: Item): item is Enum {
//   return "variants" in item;
// }

// function itemIsConst(item: Item): item is Const {
//   return "isConst" in item;
// }

// function itemIsProcedure(item: Item): item is Procedure {
//   return "body" in item;
// }

// function itemIsCodeComment(item: Item): item is CodeComment {
//   return "comment" in item;
// }

// function renderItem(ctx: Context, rs: RenderState, item: Item): Code {
//   if (itemIsInterface(item)) {
//     return renderInterface(ctx, rs, item);
//   } else if (itemIsInterfaceImplementation(item)) {
//     return renderInterfaceImplementation(ctx, rs, item);
//   } else if (itemIsTypeDef(item)) {
//     return renderTypeDef(ctx, rs, item);
//   } else if (itemIsStruct(item)) {
//     return renderStruct(ctx, rs, item);
//   } else if (itemIsEnum(item)) {
//     return renderEnum(ctx, rs, item);
//   } else if (itemIsConst(item)) {
//     return renderConst(ctx, rs, item);
//   } else if (itemIsProcedure(item)) {
//     return renderProcedure(ctx, rs, item);
//   } else if (itemIsCodeComment(item)) {
//     return renderCodeComment(ctx, rs, item);
//   } else {
//     return item;
//   }
// }

// function renderInterface(ctx: Context, rs: RenderState, iface: Interface): Code {
//   return "TODO Interface";
// }

// function renderInterfaceImplementation(ctx: Context, rs: RenderState, implementation: InterfaceImplementation): Code {
//   return "TODO InterfaceImplementation";
// }

// function renderTypeDef(ctx: Context, rs: RenderState, tdef: TypeDef): Code {
//   return "TODO TypeDef";
// }

// function renderEnum(ctx: Context, rs: RenderState, enm: Enum): Code {
//   return "TODO Enum";
// }

// function renderConst(ctx: Context, rs: RenderState, cnst: Const): Code {
//   return "TODO Const";
// }

// function renderProcedure(ctx: Context, rs: RenderState, proc: Procedure): Code {
//   return "TODO Procedure";
// }

// function renderCodeComment(ctx: Context, rs: RenderState, comment: CodeComment): Code {
//   return "TODO comment";
// }

// function renderStruct(ctx: Context, rs: RenderState, struct: Struct): Code {
//   const code: Code[] = [];

//   if (struct.docComment) {
//     code.push(<DocComment>{struct.docComment}</DocComment>);
//   }

//   const actualDef: Expression[] = [<Keyword>struct</Keyword>, <Ws/>, <Def n={struct.id} r={struct.name}/>];
//   code.push(actualDef);
//   const [fieldBlock, finalLine] = curlyBlock(actualDef, );

//   return {
//     previewed: {
//       wrapWith: noWrap,
//       code,
//     }
//   };
// }

// // export type Struct = {
// //   docComment?: Expression;
// //   /**
// //    * For DefRef.
// //    */
// //   id: string;
// //   name: Expression;
// //   typeParameters?: TypeParameterDef;
// //   fields: Field[];
// // };

// // export type Field = {
// //   docComment?: Expression;
// //   /**
// //    * For DefRef.
// //    */
// //   id: string;
// //   name: Expression;
// //   rhs: Type;
// // };

// /**
//  * Identity function for the `wrapWith` property of `previewed` in `Code`.
//  */
// export function noWrap(_ctx: Context, exp: Expression): Expression {
//   return exp;
// }

// export function DocComment({children}: {children: Expressions}): Expression {
//   return <Div clazz="doccom"><exps x={children}/></Div>;
// }

// export function Keyword({children}: {children: Expressions}): Expression {
//   return <Span clazz="kw"><exps x={children}/></Span>;
// }

// export function Ws(): Expression {
//   return " ";
// }

// // TODO struct literal and enum literal expressions
