import { Expression, Expressions } from "../../deps.ts";
import { RenderGlobalAttributes, TagProps } from "../global.tsx";
import { RenderNonVoidElement } from "../renderUtils.tsx";

/**
 * The [p element](https://html.spec.whatwg.org/multipage/grouping-content.html#the-p-element) represents a [paragraph](https://html.spec.whatwg.org/multipage/dom.html#paragraph).
 */
export function P(
  props: TagProps & { children?: Expressions },
): Expression {
  return (
    <RenderNonVoidElement
      name="p"
      attrs={<RenderGlobalAttributes attrs={props} />}
      children={props.children}
    />
  );
}
