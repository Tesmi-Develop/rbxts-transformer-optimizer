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

export function isRbxtsArray(node: ts.TypeNode): boolean {
	const typeChecker = TransformContext.instance.typeChecker;
	const type = typeChecker.getTypeFromTypeNode(node);
	const a = type.getProperties();
	//return ts.isIdentifier(node) && node.text === "Array";
	return true;
}
