import { expandEmbeddedImportMap } from "https://deno.land/x/esbuild_deno_loader@0.9.0/src/shared.ts";
import {
  CommentLine,
  Deemph,
  Def,
  Delimited,
  dependencyCss,
  dependencyJs,
  Div,
  exposeCssAndJsDependencies,
  Indent,
  InlineComment,
  Keyword,
  Keyword2,
  Loc,
  mapMaybeCommented,
  MaybeCommented,
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
import { EscapeHtml } from "../mod.tsx";

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
  return (
    <impure
      fun={(ctx) => {
        const [cssDeps, jsDeps] = exposeCssAndJsDependencies(ctx);

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

        for (const dep of cssDeps) {
          dependencyCss(ctx, dep);
        }
        for (const dep of jsDeps) {
          dependencyJs(ctx, dep);
        }

        return Def({ ...props, defClass, refClass });
      }}
    />
  );
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

export type TupleTypeProps = {
  types?: MaybeCommented<Expressions>[];
  multiline?: boolean;
};

/**
 * An anonymous tuple type, i.e., an anonymous product.
 */
export function TupleType(
  { types, multiline }: TupleTypeProps,
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
  { types, multiline }: {
    types: MaybeCommented<Expressions>[];
    multiline?: boolean;
  },
): Expression {
  const separatedContent: Expressions = [];
  for (let i = 0; i < types.length; i++) {
    let exps: Expressions;
    let comment: Expressions | undefined = undefined;
    let commentDedicatedLine = false;

    const currentType = types[i];
    if (
      typeof currentType === "object" && "commented" in currentType
    ) {
      exps = currentType.commented.segment;
      comment = currentType.commented.comment;
      commentDedicatedLine = !!currentType.commented.dedicatedLine;
    } else {
      exps = currentType;
    }

    const addPipe = multiline || (i > 0);

    const stuffToRender: Expression[] = addPipe
      ? [
        <>
          <Deemph>|</Deemph>
          {" "}
        </>,
      ]
      : [];

    stuffToRender.push(<exps x={exps} />);

    if (!multiline) {
      stuffToRender.push(" ");

      if (comment !== undefined) {
        stuffToRender.push(
          <>
            <InlineComment>
              <exps x={comment} />
            </InlineComment>
            {" "}
          </>,
        );
      }
    }

    if (multiline) {
      if (comment !== undefined && commentDedicatedLine) {
        separatedContent.push(
          <CommentLine>
            <exps x={comment} />
          </CommentLine>,
        );
      }

      separatedContent.push(
        <Loc
          comment={comment !== undefined && !commentDedicatedLine
            ? comment
            : undefined}
        >
          <exps x={stuffToRender} />
        </Loc>,
      );
    } else {
      separatedContent.push(<exps x={stuffToRender} />);
    }
  }

  const betweenDelimiters = multiline
    ? (
      <SpliceLoc>
        <Indent>
          <exps x={separatedContent} />
        </Indent>
      </SpliceLoc>
    )
    : <exps x={separatedContent} />;

  return betweenDelimiters;
}

export type FunctionTypeProps = {
  /**
   * The sequence of argument types.
   */
  args: MaybeCommented<Expression>[];
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
  args: MaybeCommented<[string, string, Expression]>[];
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
      args={mapMaybeCommented(args, ([id, n, type]) => (
        <TypeAnnotation
          type={type}
        >
          <RenderFreshValue id={[id, n]} />
        </TypeAnnotation>
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
  return <DefValue n={n} r={r} />;
}

export type ArrayTypeProps = {
  /**
   * The type of values contained in the arrays.
   */
  children: Expressions;
  /**
   * How many items each array contains.
   */
  count: Expressions;
};

/**
 * An array type, i.e., a sequence of known length containing values of the same type.
 */
export function ArrayType(
  { children, count }: ArrayTypeProps,
): Expression {
  return (
    <Delimited
      c={["[", "]"]}
      content={[children, count]}
      separator=";"
    />
  );
}

export type PointerTypeProps = {
  /**
   * The type of values that the pointer can point to.
   */
  children: Expressions;
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
  { children, mut }: PointerTypeProps,
): Expression {
  const kw: Expression = mut
    ? (typeof mut === "boolean" ? <Mut /> : <Keyword2>{mut}</Keyword2>)
    : "";
  return (
    <>
      <Deemph>&</Deemph>
      {kw}
      {kw === "" ? "" : " "}
      <exps x={children} />
    </>
  );
}

/**
 * A slice type, i.e., a reference to zero or more values, consecutively stored in memory.
 */
export function SliceType(
  { children, mut }: PointerTypeProps,
): Expression {
  const kw: Expression = mut
    ? (typeof mut === "boolean" ? <Mut /> : <Keyword2>{mut}</Keyword2>)
    : "";
  return (
    <>
      <Deemph>&</Deemph>
      {kw}
      {kw === "" ? "" : " "}
      <Delimiters delims={["[", "]"]}>
        <exps x={children} />
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
  args: MaybeCommented<Expression>[];
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
        c={[<EscapeHtml>{"<"}</EscapeHtml>, <EscapeHtml>{">"}</EscapeHtml>]}
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
  args: MaybeCommented<Expression>[];
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
 * An ascii greater-than operator.
 */
export function Gt(): Expression {
  return <EscapeHtml>{">"}</EscapeHtml>;
}

/**
 * An ascii greater-than-or-equal-to operator.
 */
export function Gte(): Expression {
  return <EscapeHtml>{">="}</EscapeHtml>;
}

/**
 * An ascii less-than operator.
 */
export function Lt(): Expression {
  return <EscapeHtml>{"<"}</EscapeHtml>;
}

/**
 * An ascii less-than-or-equal-to operator.
 */
export function Lte(): Expression {
  return <EscapeHtml>{"<="}</EscapeHtml>;
}

/**
 * An ascii bitwise-and operator.
 */
export function And(): Expression {
  return <EscapeHtml>{"&"}</EscapeHtml>;
}

/**
 * An ascii logical-and operator.
 */
export function Land(): Expression {
  return <EscapeHtml>{"&&"}</EscapeHtml>;
}

/**
 * A type annotation.
 */
export function TypeAnnotation(
  { children, type }: { children: Expressions; type: Expressions },
): Expression {
  return (
    <>
      <exps x={children} />
      <Deemph>:</Deemph>
      {` `}
      <exps x={type} />
    </>
  );
}

export type TupleProps = {
  /**
   * An optional name to preface the tuple with.
   */
  name?: Expressions;
  /**
   * Whether to give each field its on line of code.
   */
  multiline?: boolean;
  /**
   * The field expressions.
   */
  fields?: MaybeCommented<Expressions>[];
};

/**
 * An anonymous tuple, i.e., an anonymous product expression. Optionally less anonymous by prefixing it with a name (the fields remain anonymous though).
 */
export function Tuple(
  { name, fields = [], multiline }: TupleProps,
): Expression {
  return (
    <>
      {name === undefined ? "" : <exps x={name} />}
      {fields.length === 0 && name !== undefined ? "" : (
        <Delimited
          c={["(", ")"]}
          content={fields}
          multiline={multiline}
          separator=","
          noRainbow={!name}
        />
      )}
    </>
  );
}

export type TupleStructProps = {
  /**
   * The Defref id of the tuple struct.
   */
  name: string;
  /**
   * Whether to give each field its on line of code.
   */
  multiline?: boolean;
  /**
   * The field expressions.
   */
  fields?: MaybeCommented<Expressions>[];
};

/**
 * A tuple struct, using DefRef to refer to the name of the tuple.
 */
export function TupleStruct(
  { name, fields = [], multiline }: TupleStructProps,
): Expression {
  return <Tuple name={<R n={name} />} fields={fields} multiline={multiline} />;
}

export type AccessProps = {
  /**
   * The expression to access.
   */
  children: Expressions;
  /**
   * Where to perform the access.
   */
  at: Expressions;
};

/**
 * Access a part of an expression.
 */
export function Access(
  { children, at }: AccessProps,
): Expression {
  return (
    <>
      <exps x={children} />
      <Deemph>.</Deemph>
      <exps x={at} />
    </>
  );
}

export type AccessTupleProps = {
  /**
   * The expression to access.
   */
  children: Expressions;
  /**
   * Where to perform the access.
   */
  at: number;
};

/**
 * Access a part of an expression.
 */
export function AccessTuple(
  { children, at }: AccessTupleProps,
): Expression {
  return <Access children={children} at={`${at}`} />;
}

export type RecordProps = {
  /**
   * An optional name to preface the record with.
   */
  name?: Expressions;
  /**
   * Whether to give each field its on line of code.
   */
  multiline?: boolean;
  /**
   * The field names and the associated expressions.
   */
  fields?: MaybeCommented<[Expressions, Expression]>[];
};

/**
 * A key-value mapping, optionally with a name preceding it.
 */
export function Record(
  { name, fields = [], multiline }: RecordProps,
): Expression {
  return (
    <>
      {name === undefined ? "" : (
        <>
          <exps x={name} />
          {" "}
        </>
      )}
      <Delimited
        c={["{", "}"]}
        pythonSkip
        multiline={multiline}
        separator=","
        content={mapMaybeCommented(fields, ([field, exp]) => (
          <>
            <exps x={field} />
            <Deemph>:</Deemph> <exps x={exp} />
          </>
        ))}
      />
    </>
  );
}

export type StructProps = {
  /**
   * Defref id of the struct.
   */
  name: string;
  /**
   * Whether to give each field its on line of code.
   */
  multiline?: boolean;
  /**
   * The field names and the associated expressions.
   */
  fields?: MaybeCommented<[string, Expression]>[];
};

/**
 * A struct mapping, using DefRef to refer struct name and field names.
 */
export function Struct(
  { name, fields = [], multiline }: StructProps,
): Expression {
  return (
    <Record
      name={<R n={name} />}
      multiline={multiline}
      fields={mapMaybeCommented(
        fields,
        ([field, exp]) => [<R n={field} />, exp],
      )}
    />
  );
}

export type AccessStructProps = {
  /**
   * The expression to access.
   */
  children: Expressions;
  /**
   * Where to perform the access.
   */
  field: string;
};

/**
 * Access a part of an expression.
 */
export function AccessStruct(
  { children, field }: AccessStructProps,
): Expression {
  return <Access children={children} at={<R n={field} />} />;
}

export type EnumLiteralRawProps = {
  /**
   * The name of the enum.
   */
  name: Expressions;
  /**
   * Everything after the `name::`.
   */
  children: Expressions;
};

/**
 * An anonymous tuple, i.e., an anonymous product expression. Optionally less anonymous by prefixing it with a name (the fields remain anonymous though).
 */
export function EnumLiteralRaw(
  { name, children }: EnumLiteralRawProps,
): Expression {
  return (
    <>
      <exps x={name} />
      <Deemph>::</Deemph>
      <exps x={children} />
    </>
  );
}

export type EnumLiteralProps = {
  /**
   * The Defref id of the enum.
   */
  name: string;
  /**
   * Everything after the `name::`.
   */
  children: Expressions;
};

/**
 * A tuple struct, using DefRef to refer to the name of the tuple.
 */
export function EnumLiteral(
  { name, children }: EnumLiteralProps,
): Expression {
  return <EnumLiteralRaw name={<R n={name} />} children={children} />;
}

export type IsVariantProps = {
  /**
   * The enum variant to test for.
   */
  variant: Expressions;
  /**
   * The expression to test.
   */
  children: Expressions;
};

/**
 * Testing whether an expression evaluates to a value of a certain enum variant.
 */
export function IsVariant({ variant, children }: IsVariantProps): Expression {
  return (
    <>
      <exps x={children} /> <Keyword2>is</Keyword2> <exps x={variant} />
    </>
  );
}

export type FunctionLiteralUntypedProps = {
  /**
   * The sequence of argument names (name first, unique id second).
   */
  args: MaybeCommented<[string, string]>[];
  /**
   * Whether to render the argument types one type per line.
   */
  multilineArgs?: boolean;
  /**
   * The function body.
   */
  body: Expressions[];
  /**
   * Whether the body should be inline instead of an indented block.
   */
  singleLineBody?: boolean;
};

/**
 * A function literal (aka anonymous function, lambda expression, closure) without type annotations.
 */
export function FunctionLiteralUntyped(
  { args, multilineArgs, body, singleLineBody }: FunctionLiteralUntypedProps,
): Expression {
  return (
    <>
      <Delimited
        c={["(", ")"]}
        content={mapMaybeCommented(
          args,
          ([id, n]) => <RenderFreshValue id={[id, n]} />,
        )}
        multiline={multilineArgs}
        separator=","
      />
      {` `}
      <Deemph>{`->`}</Deemph>
      {` `}
      <Delimited
        c={["{", "}"]}
        pythonSkip
        ruby={["", "end"]}
        content={body}
        multiline={!singleLineBody}
      />
    </>
  );
}

export type FunctionLiteralProps = {
  /**
   * The sequence of argument names (name first, unique id second).
   */
  args: MaybeCommented<[string, string, Expression]>[];
  /**
   * Whether to render the argument types one type per line.
   */
  multilineArgs?: boolean;
  /**
   * The return type.
   */
  ret?: Expressions;
  /**
   * The function body.
   */
  body: Expressions[];
  /**
   * Whether the body should be inline instead of an indented block.
   */
  singleLineBody?: boolean;
};

/**
 * A function literal (aka anonymous function, lambda expression, closure) with type annotations.
 */
export function FunctionLiteral(
  { args, multilineArgs, body, singleLineBody, ret }: FunctionLiteralProps,
): Expression {
  return (
    <>
      <Delimited
        c={["(", ")"]}
        content={mapMaybeCommented(
          args,
          ([id, n, ty]) => {
            return (
              <TypeAnnotation
                type={ty}
              >
                <RenderFreshValue id={[id, n]} />
              </TypeAnnotation>
            );
          },
        )}
        multiline={multilineArgs}
        separator=","
      />
      {` `}
      <Deemph>{`->`}</Deemph>
      {` `}
      {ret === undefined ? "" : (
        <>
          <exps x={ret} />
          {" "}
        </>
      )}
      <Delimited
        c={["{", "}"]}
        pythonSkip
        ruby={["", "end"]}
        content={body}
        multiline={!singleLineBody}
      />
    </>
  );
}

export type ApplicationRawProps = {
  /**
   * Function to call.
   */
  fun: Expressions;
  /**
   * Optional generics.
   */
  generics?: MaybeCommented<Expression>[];
  /**
   * Whether to render the generics one type per line.
   */
  multilineGenerics?: boolean;
  /**
   * The argument expressions
   */
  args?: MaybeCommented<Expression>[];
  /**
   * Whether to render the arguments one expression per line.
   */
  multilineArgs?: boolean;
};

/**
 * A type application for an arbitrary type constructor expression.
 */
export function ApplicationRaw(
  { fun, generics, multilineGenerics, args = [], multilineArgs }:
    ApplicationRawProps,
): Expression {
  return (
    <>
      <exps x={fun} />
      {generics === undefined ? "" : (
        <Delimited
          c={[<EscapeHtml>{"<"}</EscapeHtml>, <EscapeHtml>{">"}</EscapeHtml>]}
          content={generics}
          multiline={multilineGenerics}
          separator=","
        />
      )}
      <Delimited
        c={["(", ")"]}
        content={args}
        multiline={multilineArgs}
        separator=","
      />
    </>
  );
}

export type ApplicationProps = {
  /**
   * DefRef id of the function to call.
   */
  fun: string;
  /**
   * Optional generics.
   */
  generics?: MaybeCommented<Expression>[];
  /**
   * Whether to render the generics one type per line.
   */
  multilineGenerics?: boolean;
  /**
   * The argument expressions
   */
  args?: MaybeCommented<Expression>[];
  /**
   * Whether to render the arguments one expression per line.
   */
  multilineArgs?: boolean;
};

export function Application(
  { fun, generics, multilineGenerics, args = [], multilineArgs }:
    ApplicationProps,
): Expression {
  return ApplicationRaw({
    fun: <R n={fun} />,
    generics,
    multilineGenerics,
    args,
    multilineArgs,
  });
}

export type ArrayLiteralProps = {
  /**
   * Whether to give each field its on line of code.
   */
  multiline?: boolean;
  /**
   * The field expressions.
   */
  fields?: MaybeCommented<Expressions>[];
};

/**
 * An array literal, listing all values explicitly.
 */
export function ArrayLiteral(
  { fields = [], multiline }: ArrayLiteralProps,
): Expression {
  return (
    <Delimited
      c={["[", "]"]}
      content={fields}
      multiline={multiline}
      separator=","
    />
  );
}

export type ArrayRepeatedProps = {
  /**
   * The expression to repeat.
   */
  children: Expressions;
  /**
   * The number of repititions
   */
  repetitions: Expressions;
};

/**
 * An array literal, listing all values explicitly.
 */
export function ArrayRepeated(
  { children, repetitions }: ArrayRepeatedProps,
): Expression {
  return (
    <Delimiters delims={["[", "]"]}>
      <exps x={children} />
      <Deemph>;</Deemph> <exps x={repetitions} />
    </Delimiters>
  );
}

export type IndexProps = {
  /**
   * The expression to access.
   */
  children: Expressions;
  /**
   * Where to index.
   */
  index: Expressions;
};

/**
 * Index into an array or slice.
 */
export function Index(
  { children, index }: IndexProps,
): Expression {
  return (
    <>
      <exps x={children} />
      <Delimiters delims={["[", "]"]}>
        <exps x={index} />
      </Delimiters>
    </>
  );
}

export type ReferenceProps = {
  /**
   * The expression of which to take a reference.
   */
  children: Expressions;
  /**
   * Whether the reference allows mutation, or is writeonly, or full opaque.
   */
  mut?: boolean | "writeonly" | "opaque";
};

/**
 * Take a reference to a value.
 */
export function Reference(
  { children, mut }: ReferenceProps,
): Expression {
  const kw: Expression = mut
    ? (typeof mut === "boolean" ? <Mut /> : <Keyword2>{mut}</Keyword2>)
    : "";
  return (
    <>
      <Deemph>&</Deemph>
      {kw}
      {kw === "" ? "" : " "}
      <exps x={children} />
    </>
  );
}

/**
 * Dereference a value.
 */
export function Deref(
  { children }: { children: Expressions },
): Expression {
  return (
    <>
      <Deemph>*</Deemph>
      <exps x={children} />
    </>
  );
}

export type RangeProps = {
  /**
   * Where should the slice begin?
   */
  from?: Expressions;
  /**
   * Where should the slice end?
   */
  to?: Expressions;
  /**
   * Is the end inclusive?
   */
  inclusive?: boolean;
};

/**
 * An iterator that produces a range of values.
 */
export function RangeLiteral(
  { from = "", to = "", inclusive }: RangeProps,
): Expression {
  return (
    <>
      <exps x={from} />
      <Deemph>..{inclusive ? "=" : ""}</Deemph>
      <exps x={to} />
    </>
  );
}

export type SliceProps = {
  /**
   * The expression of which to take a slice.
   */
  children: Expressions;
  /**
   * Whether the reference allows mutation, or is writeonly, or full opaque.
   */
  mut?: boolean | "writeonly" | "opaque";
} & RangeProps;

/**
 * Take a reference to a value.
 */
export function Slice(
  { children, mut, from = "", to = "", inclusive }: SliceProps,
): Expression {
  const kw: Expression = mut
    ? (typeof mut === "boolean" ? <Mut /> : <Keyword2>{mut}</Keyword2>)
    : "";
  return (
    <>
      <Deemph>&</Deemph>
      {kw}
      {kw === "" ? "" : " "}
      <exps x={children} />
      <Delimiters delims={["[", "]"]}>
        <RangeLiteral from={from} to={to} inclusive={inclusive} />
      </Delimiters>
    </>
  );
}

/**
 * Render a `mut` keyword.
 */
export function Mut(): Expression {
  return <Keyword2>mut</Keyword2>;
}

/**
 * Render the assignment operator `:=`.
 */
export function AssignmentOp(): Expression {
  return <Deemph>:=</Deemph>;
}

export type LetRawProps = {
  /**
   * The left side of the definition.
   */
  lhs: Expressions;
  /**
   * Whether to prefix the lhs with a `mut` keyword.
   */
  mut?: boolean;
  /**
   * An optional type annotation.
   */
  type?: Expressions;
  /**
   * The right side of the definition.
   */
  children: Expressions;
};

/**
 * Create a local variable.
 */
export function LetRaw(
  { children, mut, lhs, type }: LetRawProps,
): Expression {
  return (
    <>
      <Keyword>let</Keyword>
      {mut
        ? (
          <>
            {" "}
            <Mut />
          </>
        )
        : ""}{" "}
      {type === undefined ? <exps x={lhs} /> : (
        <TypeAnnotation type={type}>
          <exps x={lhs} />
        </TypeAnnotation>
      )} <AssignmentOp /> <exps x={children} />
    </>
  );
}

export type LetProps = {
  /**
   * The identifier to use as the left-hand side of the definition.
   */
  lhs: FreshId;
  /**
   * Whether to prefix the lhs with a `mut` keyword.
   */
  mut?: boolean;
  /**
   * An optional type annotation.
   */
  type?: Expressions;
  /**
   * The right side of the definition.
   */
  children: Expressions;
};

/**
 * Create a local variable.
 */
export function Let(
  { children, mut, lhs, type }: LetProps,
): Expression {
  return (
    <LetRaw mut={mut} lhs={<RenderFreshValue id={lhs} />} type={type}>
      <exps x={children} />
    </LetRaw>
  );
}

export type AssignRawProps = {
  /**
   * The left side of the assignment.
   */
  lhs: Expressions;
  /**
   * An optional assignment operator to replace the default `:=` one.
   */
  op?: Expressions;
  /**
   * The right side of the assignment.
   */
  children: Expressions;
};

/**
 * Assign to a variable.
 */
export function AssignRaw(
  { children, lhs, op }: AssignRawProps,
): Expression {
  return (
    <>
      <exps x={lhs} /> {op === undefined ? <AssignmentOp /> : (
        <Deemph>
          <exps x={op} />
        </Deemph>
      )} <exps x={children} />
    </>
  );
}

export type AssignProps = {
  /**
   * The DefRef id of the left-hand side of the assignment.
   */
  lhs: string;
  /**
   * An optional assignment operator to replace the default `:=` one.
   */
  op?: Expressions;
  /**
   * The right side of the definition.
   */
  children: Expressions;
};

/**
 * Assign to a variable, identified by its DefRef id.
 */
export function Assign(
  { children, lhs, op }: AssignProps,
): Expression {
  return (
    <AssignRaw lhs={<R n={lhs} />} op={op}>
      <exps x={children} />
    </AssignRaw>
  );
}

export type IfProps = {
  /**
   * The condition.
   */
  cond: Expressions;
  /**
   * Whether to not render the body one line per expression.
   */
  singleline?: boolean;
  /**
   * The body (run if the condition is true).
   */
  body?: Expressions[];
};

/**
 * An `if` statement.
 */
export function If({ cond, singleline, body }: IfProps): Expression {
  return (
    <>
      <Keyword>if</Keyword> <exps x={cond} />{" "}
      <Delimited
        multiline={!singleline}
        pythonSkip
        c={["{", "}"]}
        ruby={["then", "end"]}
        content={body ?? []}
      />
    </>
  );
}

export type ElseProps = {
  /**
   * Whether to not render the body one line per expression.
   */
  singleline?: boolean;
  /**
   * The body.
   */
  body?: Expressions[];
};

/**
 * An `else` statement (you probably want to place this after an `If` macro).
 */
export function Else({ singleline, body }: ElseProps): Expression {
  return (
    <>
      <Keyword>else</Keyword>{" "}
      <Delimited
        multiline={!singleline}
        pythonSkip
        c={["{", "}"]}
        ruby={["", "end"]}
        content={body ?? []}
      />
    </>
  );
}

export type ElseIfProps = {
  /**
   * Whether to not render the body one line per expression.
   */
  singleline?: boolean;
  /**
   * The body.
   */
  body?: Expressions[];
};

/**
 * An `else` statement (you probably want to place this after an `If` macro).
 */
export function ElseIf({ singleline, body }: ElseIfProps): Expression {
  return (
    <>
      <Keyword>else</Keyword> <Keyword>if</Keyword>{" "}
      <Delimited
        multiline={!singleline}
        pythonSkip
        c={["{", "}"]}
        ruby={["then", "end"]}
        content={body ?? []}
      />
    </>
  );
}

export type MatchProps = {
  /**
   * The expression to match on.
   */
  exp: Expressions;
  /**
   * The cases. The first pair member is the pattern, the second is the corresponding body - rendered as a block if it is an array.
   */
  cases: MaybeCommented<[Expressions, (Expression | Expression[])]>[];
};

/**
 * A `match` statement.
 */
export function Match({ exp, cases }: MatchProps): Expression {
  return (
    <>
      <Keyword>match</Keyword> <exps x={exp} />{" "}
      <Delimited
        multiline
        pythonSkip
        c={["{", "}"]}
        ruby={["cases", "end"]}
        content={mapMaybeCommented(cases, ([theCase, body]) => {
          return (
            <>
              <exps x={theCase} /> <Deemph>{"=>"}</Deemph> {Array.isArray(body)
                ? (
                  <Delimited
                    multiline
                    pythonSkip
                    c={["{", "}"]}
                    ruby={["case", "end"]}
                    content={body}
                  />
                )
                : <exps x={body} />}
            </>
          );
        })}
      />
    </>
  );
}

/**
 * The blank pattern that matches everything.
 */
export function BlankPattern(): Expression {
  return <Deemph>_</Deemph>;
}

/**
 * A `return` statement.
 */
export function Return({ children }: { children?: Expression }): Expression {
  return (
    <>
      <Keyword>return</Keyword>
      {children === undefined ? "" : (
        <>
          {" "}
          <exps x={children} />
        </>
      )}
    </>
  );
}

/**
 * A `return` statement.
 */
export function Break({ children }: { children?: Expression }): Expression {
  return (
    <>
      <Keyword>break</Keyword>
      {children === undefined ? "" : (
        <>
          {" "}
          <exps x={children} />
        </>
      )}
    </>
  );
}

export type WhileProps = {
  /**
   * The condition.
   */
  cond: Expressions;
  /**
   * Whether to not render the body one line per expression.
   */
  singleline?: boolean;
  /**
   * The body (run while the condition is true).
   */
  body?: Expressions[];
};

/**
 * A `while` loop.
 */
export function While({ cond, singleline, body }: WhileProps): Expression {
  return (
    <>
      <Keyword>while</Keyword> <exps x={cond} />{" "}
      <Delimited
        multiline={!singleline}
        pythonSkip
        c={["{", "}"]}
        ruby={["do", "end"]}
        content={body ?? []}
      />
    </>
  );
}

export type LoopProps = {
  /**
   * Whether to not render the body one line per expression.
   */
  singleline?: boolean;
  /**
   * The body (run while the condition is true).
   */
  body?: Expressions[];
};

/**
 * A loop statement (equivalent to `while true`).
 */
export function Loop({ singleline, body }: LoopProps): Expression {
  return (
    <>
      <Keyword>loop</Keyword>{" "}
      <Delimited
        multiline={!singleline}
        pythonSkip
        c={["{", "}"]}
        ruby={["do", "end"]}
        content={body ?? []}
      />
    </>
  );
}

export type ForRawProps = {
  /**
   * The pattern for the element for the current iteration.
   */
  pattern: Expressions;
  /**
   * Whether to prefix the pattern by the `mu` keyword.
   */
  mut?: boolean;
  /**
   * The iterator to consume with the loop.
   */
  iterator: Expressions;
  /**
   * Whether to not render the body one line per expression.
   */
  singleline?: boolean;
  /**
   * The body (run once for each value of the iterator).
   */
  body?: Expressions[];
};

/**
 * A `for` loop.
 */
export function ForRaw(
  { pattern, mut, iterator, singleline, body }: ForRawProps,
): Expression {
  return (
    <>
      <Keyword>for</Keyword> {mut
        ? (
          <>
            <Mut />
            {" "}
          </>
        )
        : ""}
      <exps x={pattern} /> <Keyword>in</Keyword> <exps x={iterator} />{" "}
      <Delimited
        multiline={!singleline}
        pythonSkip
        c={["{", "}"]}
        ruby={["do", "end"]}
        content={body ?? []}
      />
    </>
  );
}

export type ForProps = {
  /**
   * The pattern for the element for the current iteration.
   */
  pattern: FreshId;
  /**
   * Whether to prefix the pattern by the `mu` keyword.
   */
  mut?: boolean;
  /**
   * The iterator to consume with the loop.
   */
  iterator: Expressions;
  /**
   * Whether to not render the body one line per expression.
   */
  singleline?: boolean;
  /**
   * The body (run once for each value of the iterator).
   */
  body?: Expressions[];
};

/**
 * A `for` loop, creating a fresh id as the pattern.
 */
export function For(
  { pattern, mut, iterator, singleline, body }: ForProps,
): Expression {
  return (
    <ForRaw
      pattern={<RenderFreshValue id={pattern} />}
      mut={mut}
      iterator={iterator}
      singleline={singleline}
      body={body}
    />
  );
}
