/* eslint-disable @typescript-eslint/no-unused-vars */
import { Node } from "typescript";
import {
	createVariable,
	createVariableWithIdentifier,
	getCollectionNodeFromCallExpression,
	isRbxtsArray,
} from "../utility";
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
		return factory.createBlock(
			[
				factory.createExpressionStatement(
					factory.createBinaryExpression(
						factory.createElementAccessExpression(
							factory.createIdentifier(this.currentResultVariableName),
							factory.createNumericLiteral(this.currentIndexVarriableName),
						),
						factory.createToken(ts.SyntaxKind.EqualsToken),
						node,
					),
				),
				factory.createContinueStatement(undefined),
			],
			true,
		);
	}

	protected processReturn(node: ts.ReturnStatement) {
		const returnValue = node.expression;
		const factory = TransformContext.instance.factory;
		const statements: ts.Statement[] = [factory.createContinueStatement(undefined)];

		if (returnValue) {
			statements.unshift(
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

		return factory.createBlock(statements, true);
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
							factory.createPropertyAccessExpression(nodes[1], factory.createIdentifier("size")),
							undefined,
							[],
						),
					],
				),
				this.getArrayType(callExpression),
			),
		);
		ts.isVariableDeclaration(nodes[0][0]) ? nodes[0].splice(0, 1, resultNode) : nodes[0].unshift(resultNode);

		return nodes;
	}
}
