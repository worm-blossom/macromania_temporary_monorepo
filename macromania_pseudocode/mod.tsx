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
