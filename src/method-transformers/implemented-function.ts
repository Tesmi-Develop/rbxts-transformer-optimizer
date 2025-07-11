import { CallExpression, Node } from "typescript";
import { MethodTransformer } from "./method-transformer";
import ts from "typescript";
import { TransformContext } from "../transformer";

export class ImplementedFunction implements MethodTransformer {
	private declaredArguments: Map<ts.ParameterDeclaration, ts.Expression> = new Map();

	IsCanOptimize(node: Node): boolean {
		const declaration = this.getFunctionDeclaration(node as CallExpression);
		if (declaration === undefined) return false;

		return declaration.body !== undefined;
	}

	Indentify(node: Node): boolean {
		if (!ts.isCallExpression(node)) return false;

		const identifier = node.expression;
		const typeChecker = TransformContext.instance.typeChecker;
		const symbol = typeChecker.getSymbolAtLocation(identifier);
		const declaration = symbol?.declarations?.[0];

		if (
			declaration === undefined ||
			(!ts.isFunctionLikeDeclaration(declaration) &&
				!(
					ts.isVariableDeclaration(declaration) &&
					declaration.initializer !== undefined &&
					ts.isFunctionLikeDeclaration(declaration.initializer)
				))
		)
			return false;

		return ts.getJSDocTags(declaration).find((tag) => tag.tagName.text === "implementable") !== undefined;
	}

	ProcessNode(node: Node): [Node, boolean] {
		if (this.declaredArguments.size === 0 || !ts.isIdentifier(node)) return [node, false];

		const typeChecker = TransformContext.instance.typeChecker;
		const symbol = typeChecker.getSymbolAtLocation(node);
		if (symbol === undefined) return [node, false];

		const declaration = symbol?.declarations?.[0];
		if (declaration === undefined || !ts.isParameter(declaration) || !this.declaredArguments.has(declaration))
			return [node, false];

		return [this.declaredArguments.get(declaration)!, true];
	}

	private getFunctionDeclaration(node: CallExpression) {
		const identifier = node.expression;
		const typeChecker = TransformContext.instance.typeChecker;
		const symbol = typeChecker.getSymbolAtLocation(identifier);
		const declaration = symbol?.declarations?.[0];

		if (declaration !== undefined && ts.isVariableDeclaration(declaration)) {
			if (declaration.initializer !== undefined && ts.isFunctionLikeDeclaration(declaration.initializer)) {
				return declaration.initializer;
			}
		}

		if (declaration === undefined || !ts.isFunctionLikeDeclaration(declaration)) return;

		return declaration;
	}

	private processLineFunction(functionDeclaration: ts.FunctionLikeDeclaration, callExpression: CallExpression) {
		if (ts.isArrowFunction(functionDeclaration) && ts.isExpression(functionDeclaration.body)) {
			return this.replaceAllParameters(functionDeclaration, callExpression) as ts.Expression;
		}

		if (ts.isBlock(functionDeclaration.body!)) {
			const statement = functionDeclaration.body.statements[0];

			if (ts.isReturnStatement(statement)) {
				return (
					(this.replaceAllParameters(functionDeclaration, callExpression) as ts.Block)
						.statements[0] as ts.ReturnStatement
				).expression;
			}
		}
	}

	private isLineFunction(functionDeclaration: ts.FunctionLikeDeclaration) {
		if (ts.isArrowFunction(functionDeclaration) && ts.isExpression(functionDeclaration.body)) {
			return true;
		}
		return ts.isBlock(functionDeclaration.body!) && functionDeclaration.body.statements.length === 1;
	}

	private overrideParameters(newParameters: Map<ts.ParameterDeclaration, ts.Expression>) {
		const last = this.declaredArguments;
		this.declaredArguments = new Map(newParameters);

		return () => {
			this.declaredArguments = last;
		};
	}

	private findParameterByIdentifier(node: ts.Identifier) {
		const param = Array.from(this.declaredArguments.keys()).find(
			(param) => (param.name as ts.Identifier).text === node.text,
		);
		if (param === undefined) return;

		return this.declaredArguments.get(param);
	}

	private replaceAllParameters(functionDeclaration: ts.FunctionLikeDeclaration, callExpression: CallExpression) {
		const args = callExpression.arguments;
		const factory = TransformContext.instance.factory;
		const params = functionDeclaration.parameters;
		const paramNames = new Map<ts.ParameterDeclaration, ts.Expression>();

		params.forEach((param, index) => {
			paramNames.set(
				param,
				this.findParameterByIdentifier(args[index] as ts.Identifier) ??
					args[index] ??
					factory.createIdentifier("undefined"),
			);
		});

		const restore = this.overrideParameters(paramNames);
		const returnedNode = TransformContext.instance.transform(functionDeclaration);
		restore();

		return returnedNode.body;
	}

	Optimize(callExpression: CallExpression): Node | void {
		const functionDeclaration = this.getFunctionDeclaration(callExpression);

		if (functionDeclaration === undefined) {
			throw new Error("Not a function");
		}

		if (this.isLineFunction(functionDeclaration)) {
			return this.processLineFunction(functionDeclaration, callExpression);
		}
	}
}
