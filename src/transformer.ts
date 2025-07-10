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
			const a = this.processBlock(node) as unknown as T;
			return a;
		}

		return ts.visitEachChild(node, (node) => visitNode(node), this.context);
	}
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

function processNode(node: ts.Node) {
	const transformer = listMethodTransformers.find((methodTransformer) => methodTransformer.Indentify(node));
	if (transformer) {
		if (transformer.IsCanOptimize(node)) {
			return transformer.Optimize(node) ?? node;
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
		const returnStatement = factory.createReturnStatement(
			(processNode(node) as ts.ArrowFunction).body as ts.Expression,
		);
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

	/*if (isBlock) {
		const newStatements = node.statements.map((statement) => {
			const clearContext = overrideBlockStatements();
			const newNode = processNode(statement);
			const statements = TransformContext.blockStatements;
			clearContext();

			if (!ts.isStatement(newNode)) {
				return statements;
			}

			return [...statements, newNode];
		});

		console.log(newStatements.flat());
		return factory.updateBlock(node, newStatements.flat() as ts.Statement[]);
	}*/

	if (ts.isStatement(node)) {
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
