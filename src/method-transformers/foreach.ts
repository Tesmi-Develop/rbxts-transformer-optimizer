import ts from "typescript";
import { MethodTransformer } from "./method-transformer";
import { overrideBlockStatements, TransformContext } from "../transformer";
import {
	findAllLoopsAndSwitchs,
	getCollectionNodeFromCallExpression,
	haveReturn,
	isRbxtsArray,
	isRbxtsMap,
	isValidMethod,
} from "../utility";

export class Foreach implements MethodTransformer {
	private insideForeach = false;

	public ProcessNode(node: ts.Node): [ts.Node, boolean] {
		if (ts.isFunctionLikeDeclaration(node)) {
			const lastInsideForeach = this.insideForeach;

			this.insideForeach = false;
			const newNode = TransformContext.instance.transform(node);
			this.insideForeach = lastInsideForeach;

			return [newNode, true] as const;
		}

		if (this.insideForeach && ts.isReturnStatement(node)) {
			return [TransformContext.instance.factory.createContinueStatement(undefined), true] as const;
		}

		return [node, false] as const;
	}

	public Indentify(node: ts.Node): boolean {
		const collectionNode = getCollectionNodeFromCallExpression(node);
		return (
			this.isForeach(node) &&
			collectionNode !== undefined &&
			(isRbxtsArray(collectionNode) || isRbxtsMap(collectionNode))
		);
	}

	public IsCanOptimize(node: ts.CallExpression): boolean {
		const func = node.arguments[0];
		if (!ts.isFunctionLikeDeclaration(func)) {
			return false;
		}

		const loops = findAllLoopsAndSwitchs(func.body);
		const found = loops.find((loop) => haveReturn(loop));

		return found === undefined;
	}

	public Optimize(node: ts.CallExpression): void {
		const functionArgument = node.arguments[0] as ts.FunctionLikeDeclaration;
		const indexNode = functionArgument.parameters[1];
		const valueNode = functionArgument.parameters[0];
		const arrayName = functionArgument.parameters[2];
		let statements: ReadonlyArray<ts.Statement> = [];

		if (functionArgument.body !== undefined && ts.isBlock(functionArgument.body)) {
			statements = this.allowReplaceAllReturns(functionArgument.body).statements;
		}

		if (functionArgument.body !== undefined && !ts.isBlock(functionArgument.body)) {
			const clearContext = overrideBlockStatements();
			const statement = this.allowReplaceAllReturns(functionArgument);

			if (!this.isForeach(statement.body as ts.CallExpression)) {
				TransformContext.blockStatements.push(statement.body as ts.Statement);
			}

			statements = [...TransformContext.blockStatements];
			clearContext();
		}

		const forNodes = this.createArrayLoop(
			(node.expression as ts.PropertyAccessExpression).expression.getText(),
			ts.isIdentifier(node.expression),
			statements,
			indexNode?.name.getText(),
			valueNode?.name.getText(),
			arrayName?.name.getText(),
		);

		TransformContext.isRemoveCurrentStatement = true;
		TransformContext.blockStatements.push(...forNodes);
	}

	private isForeach(node: ts.Node): node is ts.CallExpression {
		return isValidMethod(node, "forEach", 1);
	}

	private allowReplaceAllReturns<T extends ts.Node>(node: T): T {
		const lastInsideForeach = this.insideForeach;

		this.insideForeach = true;
		node = TransformContext.instance.transform(node);
		this.insideForeach = lastInsideForeach;

		return node;
	}

	private createArrayLoop(
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
