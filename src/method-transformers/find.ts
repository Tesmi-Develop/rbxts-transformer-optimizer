/* eslint-disable @typescript-eslint/no-unused-vars */
import { Node } from "typescript";
import { createVariable, getCollectionNodeFromCallExpression, isRbxtsArray } from "../utility";
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
		collectionNode: ts.Expression,
		callExpression: ts.CallExpression,
		statements: ReadonlyArray<ts.Statement>,
		indexIdentifier: string,
		valueIdentifier: string,
		arrayVarriableName?: string,
	) {
		const factory = TransformContext.instance.factory;
		const nodes = super.createLoop(collectionNode, callExpression, statements, indexIdentifier, valueIdentifier);

		nodes[0].unshift(
			createVariable(
				this.currentResultVariableName,
				factory.createAsExpression(factory.createIdentifier("undefined"), this.getArrayType(callExpression)),
			),
		);

		return nodes;
	}
}
