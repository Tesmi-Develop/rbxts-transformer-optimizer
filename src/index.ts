import ts from "typescript";
import { repairParentLinks, TransformContext, TransformerConfig } from "./transformer";

export default function (program: ts.Program, config: TransformerConfig) {
	return (transformationContext: ts.TransformationContext): ((file: ts.SourceFile) => ts.Node) => {
		const context = new TransformContext(program, transformationContext, config);
		return (file) => {
			file = repairParentLinks(file);
			return context.transform(file);
		};
	};
}
