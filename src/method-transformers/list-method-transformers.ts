import { Filter } from "./filter";
import { Find } from "./find";
import { FindIndex } from "./findIndex";
import { Foreach } from "./foreach";
import { ImplementedFunction } from "./implemented-function";
import { ArrayMap } from "./map";
import { MethodTransformer } from "./method-transformer";

export const listMethodTransformers: MethodTransformer[] = [
	new Foreach(),
	new Find(),
	new Filter(),
	new ArrayMap(),
	new FindIndex(),
	new ImplementedFunction(),
];
