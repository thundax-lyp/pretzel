// A read/write transaction serializes refreshes across same-origin tabs, including
// HTTP deployments where Web Locks are unavailable. Keep one request pending
// until the network operation settles; closing a tab aborts and releases its lock.
export const withTokenRefreshLock = async <T>(
    action: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("pretzel-auth", 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore("refresh");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction("refresh", "readwrite");
            const store = transaction.objectStore("refresh");
            const controller = new AbortController();
            let finished = false;
            let result: T;
            let failure: unknown;
            const keepAlive = () => {
                if (finished) return;
                store.get(0).onsuccess = keepAlive;
            };
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => {
                controller.abort();
                reject(
                    failure ?? transaction.error ?? new Error("刷新锁已中断"),
                );
            };
            store.get(0).onsuccess = () => {
                keepAlive();
                action(controller.signal).then(
                    (value) => {
                        result = value;
                        finished = true;
                    },
                    (error: unknown) => {
                        failure = error;
                        finished = true;
                        if (!controller.signal.aborted) transaction.abort();
                    },
                );
            };
        });
    } finally {
        db.close();
    }
};
