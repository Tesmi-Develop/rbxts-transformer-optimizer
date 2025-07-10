/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { MethodTransformer } from "./method-transformer";
import ts, { factory } from "typescript";
import { overrideBlockStatements, TransformContext } from "../transformer";
import { findAllLoopsAndSwitchs, haveReturn, isValidMethod } from "../utility";

export abstract class BaseMethodTransformer implements MethodTransformer {
	protected abstract methodName: string;
	protected currentValueVarriableName = "";
	protected lastValueVarriableName = "";
	protected currentIndexVarriableName = "";
	protected lastIndexVarriableName = "";
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

		this.lastValueVarriableName = this.currentValueVarriableName;
		this.currentValueVarriableName = valueNode?.name.getText() ?? `__value`;

		this.lastIndexVarriableName = this.currentIndexVarriableName;
		this.currentIndexVarriableName = indexNode?.name.getText() ?? `__index`;

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
			(node.expression as ts.PropertyAccessExpression).expression.getText(),
			ts.isIdentifier(node.expression),
			statements,
			this.currentIndexVarriableName,
			this.currentValueVarriableName,
			arrayName?.name.getText(),
		);

		TransformContext.isRemoveCurrentStatement = this.isRemoveCurrentStatement;

		if (!this.isRemoveCurrentStatement) {
			node = this.processStatement(node) as ts.CallExpression;
		}

		TransformContext.blockStatements.push(...forNodes);

		this.currentValueVarriableName = this.lastValueVarriableName;
		this.currentIndexVarriableName = this.lastIndexVarriableName;

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

	protected abstract createLoop(
		arrayName: string,
		isIdentifier: boolean,
		statements: ReadonlyArray<ts.Statement>,
		indexIdentifier: string,
		valueIdentifier: string,
		arrayVarriableName?: string,
	): ts.Statement[];
}
