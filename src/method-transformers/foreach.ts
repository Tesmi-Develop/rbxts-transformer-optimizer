import ts from "typescript";
import { TransformContext } from "../transformer";
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

	protected createLoop(
		arrayName: string,
		isIdentifier: boolean,
		statements: ReadonlyArray<ts.Statement>,
		indexIdentifier?: string,
		valueIdentifier?: string,
		arrayVarriableName?: string,
	) {
		if (indexIdentifier === undefined || valueIdentifier === undefined) {
			indexIdentifier = indexIdentifier ?? `__index`;
			valueIdentifier = valueIdentifier ?? `__value`;
		}

		const factory = TransformContext.instance.factory;

		const forNodes: ts.Statement[] = [
			factory.createForOfStatement(
				undefined,
				factory.createVariableDeclarationList(
					[
						factory.createVariableDeclaration(
							factory.createArrayBindingPattern([
								factory.createBindingElement(
									undefined,
									undefined,
									factory.createIdentifier(indexIdentifier),
									undefined,
								),
								factory.createBindingElement(
									undefined,
									undefined,
									factory.createIdentifier(valueIdentifier),
									undefined,
								),
							]),
							undefined,
							undefined,
							undefined,
						),
					],
					ts.NodeFlags.Const,
				),
				factory.createCallExpression(factory.createIdentifier("pairs"), undefined, [
					factory.createIdentifier(
						arrayVarriableName !== undefined && !isIdentifier ? arrayVarriableName : arrayName,
					),
				]),
				factory.createBlock([...statements], true),
			),
		];

		if (arrayVarriableName !== undefined && !isIdentifier) {
			forNodes.unshift(
				factory.createVariableStatement(
					undefined,
					factory.createVariableDeclarationList(
						[
							factory.createVariableDeclaration(
								factory.createIdentifier(arrayVarriableName),
								undefined,
								undefined,
								factory.createIdentifier(arrayName),
							),
						],
						ts.NodeFlags.Const,
					),
				),
			);

			return [factory.createBlock(forNodes, true)];
		}

		return forNodes;
	}
}
