// Creator exposes this build-time flag through its virtual module.
declare module "cc/env" {
    export const PREVIEW: boolean;
    export const DEBUG: boolean;
}
