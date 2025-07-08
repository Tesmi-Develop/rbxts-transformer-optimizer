import ts from "typescript";

export interface MethodTransformer {
	IsCanOptimize(node: ts.Node): boolean;
	Indentify(node: ts.Node): boolean;
	ProcessNode(node: ts.Node): [ts.Node, boolean];
	Optimize(node: ts.Node): void;
}
