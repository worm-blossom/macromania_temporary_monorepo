import { expandEmbeddedImportMap } from "https://deno.land/x/esbuild_deno_loader@0.9.0/src/shared.ts";
import {
  Deemph,
  Def,
  Delimited,
  dependencyCss,
  dependencyJs,
  Div,
  Indent,
  Keyword,
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
import { Delimiters } from "../mod.tsx";
import { DefProps } from "../mod.tsx";

const l = createLogger("LoggerRustic");
const ConfigMacro = l.ConfigMacro;
export { ConfigMacro as LoggerRustic };

export type RusticConfig = {
  /**
   * How many colors to cycle through for the rainbow delimiters.
   * Defaults to three.
   */
  colorsOfTheRainbow?: number;
};

const [
  getRusticConfig,
  ConfigRustic,
] = createConfigOptions<RusticConfig, RusticConfig>(
  "ConfigRustic",
  () => ({
    colorsOfTheRainbow: 3,
  }),
  (oldValue, update) => {
    const newValue = { ...oldValue };
    if (update.colorsOfTheRainbow !== undefined) {
      newValue.colorsOfTheRainbow = update.colorsOfTheRainbow;
    }

    return newValue;
  },
);
export { ConfigRustic };

type RusticState = {
  rainbowCount: number;
};

const [getRusticState, setRusticState] = createSubstate<
  RusticState
>(
  () => ({
    rainbowCount: 0,
  }),
);

function rusticDef(props: DefProps, extraClass: string): Expression {
  const defClass: Expression[] = ["rustic", extraClass];
  if (Array.isArray(props.defClass)) {
    props.defClass.forEach((clazz) => defClass.push(clazz));
  } else if (props.defClass !== undefined) {
    defClass.push(props.defClass);
  }

  const refClass: Expression[] = ["rustic", extraClass];
  if (Array.isArray(props.refClass)) {
    props.refClass.forEach((clazz) => refClass.push(clazz));
  } else if (props.refClass !== undefined) {
    refClass.push(props.refClass);
  }

  return Def({...props, defClass, refClass});
}

/**
 * Create a DefRef definition for a value.
 */
export function DefValue(props: DefProps): Expression {
  return rusticDef(props, "value");
}

/**
 * Create a DefRef definition for a type.
 */
export function DefType(props: DefProps): Expression {
  return rusticDef(props, "type");
}

/**
 * Create a DefRef definition for a field.
 */
export function DefField(props: DefProps): Expression {
  return rusticDef(props, "field");
}

/**
 * Create a DefRef definition for an enum variant.
 */
export function DefVariant(props: DefProps): Expression {
  return rusticDef(props, "variant");
}

/**
 * Create a DefRef definition for a function.
 */
export function DefFunction(props: DefProps): Expression {
  return rusticDef(props, "function");
}

/**
 * Create a DefRef definition for an interface.
 */
export function DefInterface(props: DefProps): Expression {
  return rusticDef(props, "interface");
}

/**
 * Wrap some code in parens, to make associativity explicit.
 */
export function Parens({ children }: { children?: Expressions }): Expression {
  return (
    <Delimiters delims={["(", ")"]}>
      <exps x={children} />
    </Delimiters>
  );
}

/**
 * An anonymous tuple type, i.e., an anonymous product.
 */
export function TupleType(
  { types, multiline }: { types?: Expressions[]; multiline?: boolean },
): Expression {
  return (
    <Delimited
      c={["(", ")"]}
      content={types ?? []}
      multiline={multiline}
      separator=","
    />
  );
}

/**
 * An anonymous choice type, i.e., an anonymous sum.
 */
export function ChoiceType(
  { types, multiline }: { types: Expressions[]; multiline?: boolean },
): Expression {
  const separatedContent: Expressions = [];
  for (let i = 0; i < types.length; i++) {
    const addPipe = multiline || (i > 0);

    if (addPipe) {
      separatedContent.push(
        <>
          {(!multiline && (i !== 0)) ? " " : ""}
          <Deemph>|</Deemph> <exps x={types[i]} />
        </>,
      );
    } else {
      separatedContent.push(<exps x={types[i]} />);
    }
  }

  return multiline
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
}

export type FunctionTypeProps = {
  /**
   * The sequence of argument types.
   */
  args: Expression[];
  /**
   * The return type.
   */
  ret: Expressions;
  /**
   * Whether to render the argument types one type per line.
   */
  multiline?: boolean;
};

/**
 * A function type.
 */
export function FunctionType(
  { args, ret, multiline }: FunctionTypeProps,
): Expression {
  return (
    <>
      <Delimited
        c={["(", ")"]}
        content={args}
        multiline={multiline}
        separator=","
      />
      {` `}
      <Deemph>{`->`}</Deemph>
      {` `}
      <exps x={ret} />
    </>
  );
}

export type FunctionTypeNamedProps = {
  /**
   * The sequence of argument names and their types (name first, unique id second, type third).
   */
  args: [string, string, Expression][];
  /**
   * The return type.
   */
  ret: Expressions;
  /**
   * Whether to render the argument types one type per line.
   */
  multiline?: boolean;
};

/**
 * A function type.
 */
export function FunctionTypeNamed(
  { args, ret, multiline }: FunctionTypeNamedProps,
): Expression {
  return (
    <FunctionType
      args={args.map(([id, n, type]) => (
        <TypeAnnotation
          exp={<RenderFreshValue id={[id, n]} />}
          type={type}
        />
      ))}
      ret={ret}
      multiline={multiline}
    />
  );
}

/**
 * The type to indicate fresh ids that should be bound. Use a string if the id itself can be used as a DefRef `n` prop, use a pair of the id first and the desired `n` prop second otherwise.
 */
export type FreshId = string | [string, string];

export function RenderFreshValue(
  { id }: { id: FreshId },
): Expression {
  const [r, n] = Array.isArray(id) ? [id[0], id[1]] : [id, id];
  return <DefValue n={n} r={r}/>;
}

export type ArrayTypeProps = {
  /**
   * The type of values contained in the arrays.
   */
  inner: Expressions;
  /**
   * How many items each array contains.
   */
  count: Expressions;
};

/**
 * An array type, i.e., a sequence of known length containing values of the same type.
 */
export function ArrayType(
  { inner, count }: ArrayTypeProps,
): Expression {
  return (
    <Delimited
      c={["[", "]"]}
      content={[inner, count]}
      separator=";"
    />
  );
}

export type PointerTypeProps = {
  /**
   * The type of values that the pointer can point to.
   */
  inner: Expressions;
  /**
   * Whether the pointer allows mutation, or is writeonly, or full opaque.
   */
  mut?: boolean | "writeonly" | "opaque";
};

/**
 * A pointer type, i.e., a reference to exactly one value.
 * Please keep null pointers out of pseudocode. Thank you.
 */
export function PointerType(
  { inner, mut }: PointerTypeProps,
): Expression {
  const kw: Expression = mut
    ? (typeof mut === "boolean"
      ? <Keyword>mut</Keyword>
      : <Keyword>{mut}</Keyword>)
    : "";
  return (
    <>
      <Deemph>&</Deemph>
      {kw}
      {kw === "" ? "" : " "}
      <exps x={inner} />
    </>
  );
}

/**
 * A slice type, i.e., a reference to zero or more values, consecutively stored in memory.
 */
export function SliceType(
  { inner, mut }: PointerTypeProps,
): Expression {
  const kw: Expression = mut
    ? (typeof mut === "boolean"
      ? <Keyword>mut</Keyword>
      : <Keyword>{mut}</Keyword>)
    : "";
  return (
    <>
      <Deemph>&</Deemph>
      {kw}
      {kw === "" ? "" : " "}
      <Delimiters delims={["[", "]"]}>
        <exps x={inner} />
      </Delimiters>
    </>
  );
}

export type TypeApplicationRawProps = {
  /**
   * The type constructor.
   */
  constr: Expressions;
  /**
   * The sequence of argument types.
   */
  args: Expression[];
  /**
   * Whether to render the args one argument per line.
   */
  multiline?: boolean;
};

/**
 * A type application for an arbitrary type constructor expression.
 */
export function TypeApplicationRaw(
  { args, constr, multiline }: TypeApplicationRawProps,
): Expression {
  return (
    <>
      <exps x={constr} />
      <Delimited
        c={["<", ">"]}
        content={args}
        multiline={multiline}
        separator=","
      />
    </>
  );
}

export type TypeApplicationProps = {
  /**
   * The DefRef id of the type constructor.
   */
  constr: string;
  /**
   * The sequence of argument types.
   */
  args: Expression[];
  /**
   * Whether to render the args one argument per line.
   */
  multiline?: boolean;
};

/**
 * A type application for a type constructor given by a DefRef id.
 */
export function TypeApplication(
  { args, constr, multiline }: TypeApplicationProps,
): Expression {
  return TypeApplicationRaw({ args, constr: <R n={constr} />, multiline });
}

/**
 * A type annotation.
 */
export function TypeAnnotation(
  { exp, type }: { exp: Expressions; type: Expressions },
): Expression {
  return (
    <>
      {exp}
      <Deemph>:</Deemph>
      {` `}
      {type}
    </>
  );
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
