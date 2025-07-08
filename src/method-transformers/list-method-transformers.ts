import { Foreach } from "./array/foreach";
import { MethodTransformer } from "./method-transformer";

export const listMethodTransformers: MethodTransformer[] = [new Foreach()];
