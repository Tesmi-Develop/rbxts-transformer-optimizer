/* eslint-disable @typescript-eslint/no-unused-vars */
import { Node } from "typescript";
import {
	createOptimizedIfStatement,
	createVariableWithIdentifier,
	getCollectionNodeFromCallExpression,
	isRbxtsArray,
} from "../utility";
import ts from "typescript";
import { BaseMethodTransformer } from "./base-method-transformer";
import { TransformContext } from "../transformer";

export class FindIndex extends BaseMethodTransformer {
	protected methodName = "findIndex";
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

		const resultNode = createOptimizedIfStatement(
			node ?? factory.createFalse(),
			factory.createBlock(
				[
					factory.createExpressionStatement(
						factory.createBinaryExpression(
							factory.createIdentifier(this.currentResultVariableName),
							factory.createToken(ts.SyntaxKind.EqualsToken),
							factory.createBinaryExpression(
								factory.createIdentifier(this.currentIndexVarriableName),
								factory.createToken(ts.SyntaxKind.MinusToken),
								factory.createNumericLiteral("1"),
							),
						),
					),
					factory.createBreakStatement(undefined),
				],
				true,
			),
		);

		if (resultNode === undefined) {
			return factory.createBreakStatement(undefined);
		}

		if (ts.isBlock(resultNode)) {
			TransformContext.blockStatements.push(resultNode.statements[0]);
			return resultNode.statements[1];
		}

		return resultNode;
	}

	protected processReturn(node: ts.ReturnStatement) {
		const condition = node.expression;
		const factory = TransformContext.instance.factory;

		const resultNode = createOptimizedIfStatement(
			condition ?? factory.createFalse(),
			factory.createBlock(
				[
					factory.createExpressionStatement(
						factory.createBinaryExpression(
							factory.createIdentifier(this.currentResultVariableName),
							factory.createToken(ts.SyntaxKind.EqualsToken),
							factory.createBinaryExpression(
								factory.createIdentifier(this.currentIndexVarriableName),
								factory.createToken(ts.SyntaxKind.MinusToken),
								factory.createNumericLiteral("1"),
							),
						),
					),
					factory.createBreakStatement(undefined),
				],
				true,
			),
		);

		if (resultNode === undefined) {
			return factory.createBreakStatement(undefined);
		}

		if (ts.isBlock(resultNode)) {
			TransformContext.blockStatements.push(resultNode.statements[0]);
			return resultNode.statements[1];
		}

		return resultNode;
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
		const nodes = super.createLoop(
			collectionNode,
			callExpression,
			arrayIdentifier,
			statements,
			indexIdentifier,
			valueNode,
		);
		nodes.unshift(createVariableWithIdentifier(this.currentResultVariableName, "-1"));

		return nodes;
	}
}
