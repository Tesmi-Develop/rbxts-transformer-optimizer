/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { MethodTransformer } from "./method-transformer";
import ts, { factory } from "typescript";
import { overrideBlockStatements, repairParentLinks, TransformContext } from "../transformer";
import { createVariable, findAllLoopsAndSwitchs, getParameterName, haveReturn, isValidMethod } from "../utility";

export abstract class BaseMethodTransformer implements MethodTransformer {
	protected abstract methodName: string;
	protected currentIndexVarriableName = "";
	protected lastIndexVarriableName = "";
	protected currentArrayVarriableName = "";
	protected lastArrayVarriableName = "";
	protected isRemoveCurrentStatement = true;
	private insideMethodCallback = false;

	public abstract Indentify(node: ts.Node): boolean;

	public ProcessNode(node: ts.Node): [ts.Node, boolean] {
		if (ts.isFunctionLikeDeclaration(node)) {
			const lastInsideForeach = this.insideMethodCallback;

			this.insideMethodCallback = false;
			const newNode = TransformContext.instance.transform(node);
			this.insideMethodCallback = lastInsideForeach;

			return [newNode, true] as const;
		}

		if (this.insideMethodCallback && ts.isReturnStatement(node)) {
			const newNode =
				this.processReturn(node) ?? TransformContext.instance.factory.createContinueStatement(undefined);
			return [newNode, true] as const;
		}

		return [node, false] as const;
	}

	protected processReturn(node: ts.ReturnStatement): ts.Statement | void {}

	public IsCanOptimize(node: ts.CallExpression): boolean {
		const func = node.arguments[0];
		if (!ts.isFunctionLikeDeclaration(func)) {
			return false;
		}

		const loops = findAllLoopsAndSwitchs(func.body);
		const found = loops.find((loop) => haveReturn(loop));

		return found === undefined;
	}

	public Optimize(node: ts.CallExpression) {
		const functionArgument = node.arguments[0] as ts.FunctionLikeDeclaration;
		const indexNode = functionArgument.parameters[1];
		const valueNode = functionArgument.parameters[0];
		const arrayName = functionArgument.parameters[2];
		let statements: ReadonlyArray<ts.Statement> = [];

		this.lastIndexVarriableName = this.currentIndexVarriableName;
		this.currentIndexVarriableName = getParameterName(indexNode) ?? `__index`;

		const collectionNode = TransformContext.instance.transform(
			node.expression as ts.PropertyAccessExpression,
		).expression;
		const arrayIdentifier = ts.isIdentifier(collectionNode)
			? collectionNode
			: factory.createIdentifier(getParameterName(arrayName) ?? `__array_${TransformContext.instance.nextId()}`);

		this.lastArrayVarriableName = this.currentArrayVarriableName;
		this.currentArrayVarriableName = arrayIdentifier.text;

		if (functionArgument.body !== undefined && ts.isBlock(functionArgument.body)) {
			statements = (this.allowReplaceAllReturns(functionArgument).body! as ts.Block).statements;
		}

		if (functionArgument.body !== undefined && !ts.isBlock(functionArgument.body)) {
			const clearContext = overrideBlockStatements();
			const statement = this.allowReplaceAllReturns(functionArgument);

			const bodyNode = this.processReturnExpression(statement.body as ts.Expression);

			if (!this.isValidMethod(statement.body as ts.CallExpression)) {
				TransformContext.blockStatements.push(
					bodyNode ?? factory.createExpressionStatement(statement.body as ts.Expression),
				);
			}

			statements = [...TransformContext.blockStatements];
			clearContext();
		}

		const forNodes = this.createLoop(
			collectionNode,
			node,
			arrayIdentifier,
			statements,
			this.currentIndexVarriableName,
			valueNode?.name ?? factory.createIdentifier(`__value`),
		);

		TransformContext.isRemoveCurrentStatement = this.isRemoveCurrentStatement;

		if (!this.isRemoveCurrentStatement) {
			node = this.processStatement(node) as ts.CallExpression;
		}

		TransformContext.blockStatements.push(...forNodes);

		this.currentIndexVarriableName = this.lastIndexVarriableName;
		this.currentArrayVarriableName = this.lastArrayVarriableName;

		return node;
	}

	protected processStatement(node: ts.CallExpression): ts.Expression {
		return node;
	}

	protected processReturnExpression(node: ts.Expression): ts.Statement | void {
		const factory = TransformContext.instance.factory;
		return factory.createExpressionStatement(node);
	}

	protected isValidMethod(node: ts.Node): node is ts.CallExpression {
		return isValidMethod(node, this.methodName, 1);
	}

	private allowReplaceAllReturns<T extends ts.Node>(node: T): T {
		const lastInsideForeach = this.insideMethodCallback;

		this.insideMethodCallback = true;
		node = TransformContext.instance.transform(node);
		this.insideMethodCallback = lastInsideForeach;

		return node;
	}

	protected getCollectionNode(node: ts.Node) {
		if (ts.isIdentifier(node)) {
			return node;
		}
	}

	protected getArrayType(node: ts.Identifier | ts.CallExpression) {
		const typeChecker = TransformContext.instance.typeChecker;
		const type = typeChecker.getTypeAtLocation(node);
		return (
			typeChecker.typeToTypeNode(type, node, ts.NodeBuilderFlags.NoTruncation) ??
			factory.createArrayTypeNode(factory.createTypeReferenceNode(factory.createIdentifier("defined"), undefined))
		);
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

		const nodes: ts.Statement[] = [
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
								factory.createBindingElement(undefined, undefined, valueNode, undefined),
							]),
							undefined,
							undefined,
							undefined,
						),
					],
					ts.NodeFlags.Const,
				),
				factory.createCallExpression(factory.createIdentifier("pairs"), undefined, [arrayIdentifier]),
				factory.createBlock([...statements], true),
			),
		];

		if (!ts.isIdentifier(collectionNode)) {
			nodes.unshift(createVariable(arrayIdentifier.text, collectionNode));
		}

		return nodes;
	}
}
