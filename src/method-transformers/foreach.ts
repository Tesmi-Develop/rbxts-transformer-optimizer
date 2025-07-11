import ts from "typescript";
import { getCollectionNodeFromCallExpression, isRbxtsArray, isRbxtsMap } from "../utility";
import { BaseMethodTransformer } from "./base-method-transformer";

export class Foreach extends BaseMethodTransformer {
	protected methodName = "forEach";

	public Indentify(node: ts.Node): boolean {
		const collectionNode = getCollectionNodeFromCallExpression(node);
		return (
			this.isValidMethod(node) &&
			collectionNode !== undefined &&
			(isRbxtsArray(collectionNode) || isRbxtsMap(collectionNode))
		);
	}
}
