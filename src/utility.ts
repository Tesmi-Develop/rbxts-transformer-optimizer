import ts from "typescript";
import { TransformContext } from "./transformer";

export function isValidMethod(node: ts.Node, methodName: string, countArguments: number): node is ts.CallExpression {
	if (!ts.isCallExpression(node)) {
		return false;
	}

	const expression = node.expression;
	return (
		ts.isPropertyAccessExpression(expression) &&
		expression.name.text === methodName &&
		node.arguments.length === countArguments
	);
}

export function findAllLoopsAndSwitchsRecursive(node: ts.Node, loops: ts.Node[]) {
	ts.forEachChild(node, (child) => {
		if (ts.isFunctionLikeDeclaration(child)) {
			return;
		}

		if (ts.isIterationStatement(child, false) || ts.isSwitchStatement(child)) {
			loops.push(child);
		}

		findAllLoopsAndSwitchsRecursive(child, loops);
	});
}

export function findAllLoopsAndSwitchs(node: ts.Node) {
	const loops: ts.Node[] = [];
	findAllLoopsAndSwitchsRecursive(node, loops);

	return loops;
}

export function haveReturn(node: ts.Node): boolean {
	let isReturn = false;

	ts.forEachChild(node, (child) => {
		if (ts.isReturnStatement(child)) {
			isReturn = true;
			return;
		}

		isReturn = haveReturn(child);
		if (isReturn) {
			return;
		}
	});

	return isReturn;
}

export function isRbxtsArray(node: ts.Node): boolean {
	const typeChecker = TransformContext.instance.typeChecker;
	const type = typeChecker.getTypeAtLocation(node);
	return type.getProperties().find((prop) => prop.name === "_nominal_Array") !== undefined;
}

export function isRbxtsMap(node: ts.Node): boolean {
	const typeChecker = TransformContext.instance.typeChecker;
	const type = typeChecker.getTypeAtLocation(node);
	return type.getProperties().find((prop) => prop.name === "_nominal_Map") !== undefined;
}

export function getCollectionNodeFromCallExpression(node: ts.Node) {
	if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
		return;
	}

	return node.expression.expression;
}

export function createIdGenerator() {
	let id = 0;
	return () => id++;
}

export function createVariableWithIdentifier(variableName: string, variableIdentifier: string) {
	const factory = TransformContext.instance.factory;
	return factory.createVariableStatement(
		undefined,
		factory.createVariableDeclarationList(
			[
				factory.createVariableDeclaration(
					factory.createIdentifier(variableName),
					undefined,
					undefined,
					factory.createIdentifier(variableIdentifier),
				),
			],
			ts.NodeFlags.Let,
		),
	);
}

export function createVariable(variableName: string, variableValue: ts.Expression) {
	const factory = TransformContext.instance.factory;
	return factory.createVariableStatement(
		undefined,
		factory.createVariableDeclarationList(
			[
				factory.createVariableDeclaration(
					factory.createIdentifier(variableName),
					undefined,
					undefined,
					variableValue,
				),
			],
			ts.NodeFlags.Let,
		),
	);
}

export function getParameterName(node?: ts.ParameterDeclaration) {
	return (node?.name as ts.Identifier)?.text;
}

export function createOptimizedIfStatement(condition: ts.Expression, statement: ts.Statement) {
	const factory = TransformContext.instance.factory;

	if (condition.kind === ts.SyntaxKind.TrueKeyword) {
		return statement;
	}

	if (condition.kind === ts.SyntaxKind.FalseKeyword) {
		return;
	}

	return factory.createIfStatement(condition, statement, undefined);
}
