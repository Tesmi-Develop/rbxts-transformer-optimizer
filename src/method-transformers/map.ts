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

		forNodes.unshift(
			createVariable(
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
								factory.createPropertyAccessExpression(
									factory.createIdentifier(arrayName),
									factory.createIdentifier("size"),
								),
								undefined,
								[],
							),
						],
					),
					factory.createArrayTypeNode(
						factory.createTypeReferenceNode(factory.createIdentifier("defined"), undefined),
					),
				),
			),
		);

		return forNodes;
	}
}
