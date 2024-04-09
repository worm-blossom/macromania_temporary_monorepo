import { Expression } from "../../deps.ts";
import { RenderGlobalAttributes, TagProps } from "../global.tsx";
import { RenderVoidElement } from "../renderUtils.tsx";

/**
 * The [br element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-br-element) represents a line break.
 */
export function Br(
  attrs: TagProps
): Expression {
  return (
    <RenderVoidElement
      name="br"
      attrs={<RenderGlobalAttributes attrs={attrs} />}
    />
  );
}
