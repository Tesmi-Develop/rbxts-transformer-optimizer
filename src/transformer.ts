import ts from "typescript";
import { listMethodTransformers } from "./method-transformers/list-method-transformers";

export interface TransformerConfig {
	_: void;
}

export class TransformContext {
	public static instance: TransformContext;
	public factory: ts.NodeFactory;
	public _isRemoveCurrentStatement = false;
	private _blockStatements: ts.Statement[] = [];

	public static get isRemoveCurrentStatement() {
		return TransformContext.instance._isRemoveCurrentStatement;
	}

	public static set isRemoveCurrentStatement(value: boolean) {
		TransformContext.instance._isRemoveCurrentStatement = value;
	}

	public static get blockStatements() {
		return TransformContext.instance._blockStatements;
	}

	public static set blockStatements(value: ts.Statement[]) {
		TransformContext.instance._blockStatements = value;
	}

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
		public typeChecker = program.getTypeChecker(),
	) {
		TransformContext.instance = this;
		this.factory = context.factory;
	}

	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(node, (node) => visitNode(node), this.context);
	}
}

export function overrideBlockStatements() {
	const lastBlockStatements = TransformContext.blockStatements;
	const lastIsRemoveCurrentStatement = TransformContext.isRemoveCurrentStatement;
	TransformContext.blockStatements = [];
	TransformContext.isRemoveCurrentStatement = false;

	return () => {
		TransformContext.blockStatements = lastBlockStatements;
		TransformContext.isRemoveCurrentStatement = lastIsRemoveCurrentStatement;
	};
}

function processNode(node: ts.Node) {
	const transformer = listMethodTransformers.find((methodTransformer) => methodTransformer.Indentify(node));
	if (transformer) {
		if (transformer.IsCanOptimize(node)) {
			transformer.Optimize(node);
			return node;
		}
	}

	let currentNode = node;

	for (const methodTransformer of listMethodTransformers) {
		const [newNode, isBreak] = methodTransformer.ProcessNode(currentNode);
		currentNode = newNode;

		if (isBreak) {
			return currentNode;
		}
	}

	return TransformContext.instance.transform(currentNode);
}

function visitNode(node: ts.Node): ts.Node | ts.Node[] {
	const isBlock = ts.isBlock(node.parent) || ts.isSourceFile(node.parent);
	const lastStatements = TransformContext.blockStatements;
	const lastIsRemoveCurrentStatement = TransformContext.isRemoveCurrentStatement;
	let newNode = node;

	if (isBlock) {
		TransformContext.blockStatements = [];
		TransformContext.isRemoveCurrentStatement = false;
	}

	newNode = processNode(node);

	const returnedStatements = TransformContext.blockStatements;

	if (isBlock) {
		if (!TransformContext.isRemoveCurrentStatement) {
			TransformContext.blockStatements.unshift(newNode as ts.Statement);
		}

		TransformContext.isRemoveCurrentStatement = lastIsRemoveCurrentStatement;
		TransformContext.blockStatements = lastStatements;
	}

	if (!isBlock) {
		return newNode;
	}

	return returnedStatements;
}
