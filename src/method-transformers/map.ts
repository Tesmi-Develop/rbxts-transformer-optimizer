/* eslint-disable @typescript-eslint/no-unused-vars */
import { Node } from "typescript";
import { createVariable, getCollectionNodeFromCallExpression, isRbxtsArray } from "../utility";
import ts from "typescript";
import { BaseMethodTransformer } from "./base-method-transformer";
import { TransformContext } from "../transformer";

export class ArrayMap extends BaseMethodTransformer {
	protected methodName = "map";
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

		TransformContext.blockStatements.push(
			factory.createExpressionStatement(
				factory.createBinaryExpression(
					factory.createElementAccessExpression(
						factory.createIdentifier(this.currentResultVariableName),
						factory.createBinaryExpression(
							factory.createNumericLiteral(this.currentIndexVarriableName),
							ts.SyntaxKind.MinusToken,
							factory.createNumericLiteral("1"),
						),
					),
					factory.createToken(ts.SyntaxKind.EqualsToken),
					node,
				),
			),
		);

		return factory.createContinueStatement(undefined);
	}

	protected processReturn(node: ts.ReturnStatement) {
		const returnValue = node.expression;
		const factory = TransformContext.instance.factory;

		if (returnValue) {
			TransformContext.blockStatements.push(
				factory.createExpressionStatement(
					factory.createBinaryExpression(
						factory.createElementAccessExpression(
							factory.createIdentifier(this.currentResultVariableName),
							factory.createBinaryExpression(
								factory.createNumericLiteral(this.currentIndexVarriableName),
								ts.SyntaxKind.MinusToken,
								factory.createNumericLiteral("1"),
							),
						),
						factory.createToken(ts.SyntaxKind.EqualsToken),
						returnValue,
					),
				),
			);
		}

		return factory.createContinueStatement(undefined);
	}

	public Optimize(node: ts.CallExpression) {
		this.lastResultVariableName = this.currentResultVariableName;
		this.currentResultVariableName = `__result_${TransformContext.instance.nextId()}`;

		const newNode = super.Optimize(node);
		this.currentResultVariableName = this.lastResultVariableName;

		return newNode;
	}

	protected createLoop(
		collectionNode: ts.Expression,
		callExpression: ts.CallExpression,
		arrayIdentifier: ts.Identifier,
		statements: ReadonlyArray<ts.Statement>,
		indexIdentifier: string,
		valueNode: ts.BindingName,
	) {
		const factory = TransformContext.instance.factory;
		const nodes = super.createLoop(
			collectionNode,
			callExpression,
			arrayIdentifier,
			statements,
			indexIdentifier,
			valueNode,
		);
		const resultNode = createVariable(
			this.currentResultVariableName,
			factory.createAsExpression(
				factory.createCallExpression(
					factory.createPropertyAccessExpression(
						factory.createIdentifier("table"),
						factory.createIdentifier("create"),
					),
					undefined,
					[
						factory.createCallExpression(
							factory.createPropertyAccessExpression(arrayIdentifier, factory.createIdentifier("size")),
							undefined,
							[],
						),
					],
				),
				this.getArrayType(callExpression),
			),
		);

		ts.isVariableStatement(nodes[0]) ? nodes.splice(1, 0, resultNode) : nodes.unshift(resultNode);

		return nodes;
	}
}
