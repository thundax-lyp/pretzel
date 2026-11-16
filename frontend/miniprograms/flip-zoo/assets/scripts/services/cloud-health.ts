declare const GameGlobal: { flipZooCloudEnv?: string };
declare const wx: {
    cloud?: {
        init(options: { env: string }): void;
        callFunction(options: {
            name: string;
            data?: object;
        }): Promise<{ result: unknown }>;
    };
};

let initialized = false;

export function hasCloudEnvironment(): boolean {
    return Boolean(GameGlobal.flipZooCloudEnv);
}

export async function callCloud<T>(name: string, data?: object): Promise<T> {
    const env = GameGlobal.flipZooCloudEnv;
    const cloud = wx.cloud;
    if (!env || !cloud) throw new Error("WeChat cloud API is unavailable");
    if (!initialized) {
        cloud.init({ env });
        initialized = true;
    }
    const response = await cloud.callFunction({ name, data });
    if (!response.result) throw new Error("Cloud function returned no result");
    return response.result as T;
}

export async function checkCloudConnection(): Promise<void> {
    if (!hasCloudEnvironment()) return;
    const result = await callCloud<{ authenticated?: boolean }>(
        "flipZooHealth",
    );
    if (result.authenticated !== true) {
        throw new Error("Cloud function did not receive a WeChat identity");
    }
    console.info("FLIP ZOO cloud connection verified");
}

export async function readReleaseVersion(): Promise<string | undefined> {
    const result = await callCloud<{ version?: unknown }>("flipZooHealth", {
        action: "release-version",
    });
    return typeof result.version === "string" &&
        /^\d+\.\d+\.\d+$/.test(result.version)
        ? result.version
        : undefined;
}
