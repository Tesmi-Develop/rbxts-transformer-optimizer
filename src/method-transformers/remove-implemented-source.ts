import { Node } from "typescript";
import { MethodTransformer } from "./method-transformer";
import ts from "typescript";
import { TransformContext } from "../transformer";

export class RemoveImplementedSource implements MethodTransformer {
	IsCanOptimize(node: Node): boolean {
		return true;
	}
	Indentify(node: Node): boolean {
		if (!ts.isFunctionLikeDeclaration(node)) return false;
		return ts.getJSDocTags(node).find((tag) => tag.tagName.text === "implementable") !== undefined;
	}
	ProcessNode(node: Node): [Node, boolean] {
		return [node, false];
	}
	Optimize(node: Node): Node | false | void {
		TransformContext.isRemoveCurrentStatement = true;
		return false;
	}
}
