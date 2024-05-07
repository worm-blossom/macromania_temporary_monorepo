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
    ? (typeof mut === "boolean"
      ? <Keyword>mut</Keyword>
      : <Keyword>{mut}</Keyword>)
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
