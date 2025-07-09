import { Node } from "typescript";
import { createVariableWithIdentifier, getCollectionNodeFromCallExpression, isRbxtsArray } from "../utility";
import ts from "typescript";
import { BaseMethodTransformer } from "./base-method-transformer";
import { TransformContext } from "../transformer";

export class Find extends BaseMethodTransformer {
	protected methodName = "find";
	protected isRemoveCurrentStatement = false;
	private currentResultVariableName = "";
	private lastResultVariableName = "";

	public Indentify(node: Node): boolean {
		const collectionNode = getCollectionNodeFromCallExpression(node);
		return this.isValidMethod(node) && collectionNode !== undefined && isRbxtsArray(collectionNode);
	}

	protected processStatement() {
		const factory = TransformContext.instance.factory;
		const resultName = this.currentResultVariableName;
		return factory.createIdentifier(resultName);
	}

	protected processReturnExpression(node: ts.Expression): ts.Statement | void {
		const factory = TransformContext.instance.factory;
		return factory.createIfStatement(
			node ?? factory.createFalse(),
			factory.createBlock(
				[
					factory.createExpressionStatement(
						factory.createBinaryExpression(
							factory.createIdentifier(this.currentResultVariableName),
							factory.createToken(ts.SyntaxKind.EqualsToken),
							factory.createIdentifier(this.currentValueVarriableName),
						),
					),
					factory.createBreakStatement(undefined),
				],
				true,
			),
			undefined,
		);
	}

	protected processReturn(node: ts.ReturnStatement) {
		const condition = node.expression;
		const factory = TransformContext.instance.factory;
		return factory.createIfStatement(
			condition ?? factory.createFalse(),
			factory.createBlock(
				[
					factory.createExpressionStatement(
						factory.createBinaryExpression(
							factory.createIdentifier(this.currentResultVariableName),
							factory.createToken(ts.SyntaxKind.EqualsToken),
							factory.createIdentifier(this.currentValueVarriableName),
						),
					),
					factory.createBreakStatement(undefined),
				],
				true,
			),
			undefined,
		);
	}

	public Optimize(node: ts.CallExpression) {
		this.lastResultVariableName = this.currentResultVariableName;
		this.currentResultVariableName = `__result_${TransformContext.instance.nextId()}`;

		const newNode = super.Optimize(node);
		this.currentResultVariableName = this.lastResultVariableName;

		return newNode;
	}

	protected createLoop(
		arrayName: string,
		isIdentifier: boolean,
		statements: ReadonlyArray<ts.Statement>,
		indexIdentifier: string,
		valueIdentifier: string,
		arrayVarriableName?: string,
	) {
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
			forNodes.unshift(createVariableWithIdentifier(arrayVarriableName, arrayName));

			return [factory.createBlock(forNodes, true)];
		}

		forNodes.unshift(createVariableWithIdentifier(this.currentResultVariableName, "undefined"));

		return forNodes;
	}
}
