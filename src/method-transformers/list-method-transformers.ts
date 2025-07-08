import { Foreach } from "./foreach";
import { MethodTransformer } from "./method-transformer";

export const listMethodTransformers: MethodTransformer[] = [new Foreach()];
