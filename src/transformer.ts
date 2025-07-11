import ts from "typescript";
import { listMethodTransformers } from "./method-transformers/list-method-transformers";
import { createIdGenerator } from "./utility";

export interface TransformerConfig {
	_: void;
}

export class TransformContext {
	public static instance: TransformContext;
	public factory: ts.NodeFactory;
	public _isRemoveCurrentStatement = false;
	private _blockStatements: ts.Statement[] = [];
	public readonly nextId = createIdGenerator();

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

	processBlock(node: ts.Block | ts.SourceFile) {
		return ts.visitEachChild(
			node,
			(newNode) => {
				const clearContext = overrideBlockStatements();
				const result = visitNode(newNode);
				const newNodes = Array.isArray(result) ? result : [result];
				const statements = TransformContext.blockStatements;
				clearContext();

				return [...statements, ...newNodes];
			},
			this.context,
		);
	}

	transform<T extends ts.Node>(node: T): T {
		if (ts.isSourceFile(node) || ts.isBlock(node)) {
			return this.processBlock(node) as unknown as T;
		}

		return ts.visitEachChild(node, (node) => visitNode(node), this.context);
	}
}

export function repairParentLinks<T extends ts.Node>(root: T): T {
	ts.forEachChild(root, (node) => {
		if (node) {
			repairNodeParent(node, root);
		}
	});

	return root;
}

function repairNodeParent(node: ts.Node, parent: ts.Node): void {
	if ((node as any).parent !== parent) {
		(node as any).parent = parent;
	}

	ts.forEachChild(node, (child) => {
		if (child) {
			repairNodeParent(child, node);
		}
	});
}

export function overrideBlockStatements() {
	const lastBlockStatements = TransformContext.blockStatements;
	TransformContext.blockStatements = [];

	return () => {
		TransformContext.blockStatements = lastBlockStatements;
	};
}

export function overrideCurrentStatement() {
	const lastIsRemoveCurrentStatement = TransformContext.isRemoveCurrentStatement;
	TransformContext.isRemoveCurrentStatement = false;

	return () => {
		TransformContext.isRemoveCurrentStatement = lastIsRemoveCurrentStatement;
	};
}

function processNode(node: ts.Node): ts.Node | ts.Node[] {
	const transformer = listMethodTransformers.find((methodTransformer) => methodTransformer.Indentify(node));
	if (transformer) {
		if (transformer.IsCanOptimize(node)) {
			const result = transformer.Optimize(node);
			if (result === false) {
				return [];
			}

			return result ?? node;
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
	const factory = TransformContext.instance.factory;
	const wrapInBlock = ts.isArrowFunction(node) && node.body.kind !== ts.SyntaxKind.Block;

	if (wrapInBlock) {
		const clearContext = overrideBlockStatements();
		const result = processNode(node);

		if (Array.isArray(result) && result.length === 0) {
			clearContext();
			return [];
		}

		const returnStatement = factory.createReturnStatement((result as ts.ArrowFunction).body as ts.Expression);
		const statements = [...TransformContext.blockStatements];

		if (!TransformContext.isRemoveCurrentStatement) {
			statements.push(returnStatement);
		}

		const newNode = factory.updateArrowFunction(
			node,
			node.modifiers,
			node.typeParameters,
			node.parameters,
			node.type,
			node.equalsGreaterThanToken,
			factory.createBlock(statements, true),
		);

		clearContext();
		return newNode;
	}

	if (ts.isStatement(node) || ts.isMethodDeclaration(node)) {
		const clearContext = overrideCurrentStatement();
		const newNode = processNode(node);

		if (TransformContext.isRemoveCurrentStatement) {
			clearContext();
			return [];
		}

		clearContext();
		return newNode;
	}

	return processNode(node);
}
