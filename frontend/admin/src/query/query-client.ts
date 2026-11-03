import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    createElement,
    useEffect,
    useState,
    type PropsWithChildren,
} from "react";
import {
    getTokenSessionId,
    subscribeAccessTokenChange,
} from "@/auth/token-storage";

const createQueryClient = () => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000,
                refetchOnWindowFocus: false,
                retry: 1,
            },
        },
    });
};

export const AdminQueryProvider = ({ children }: PropsWithChildren) => {
    const [client] = useState(createQueryClient);
    useEffect(() => {
        let sessionId = getTokenSessionId();
        return subscribeAccessTokenChange(() => {
            const next = getTokenSessionId();
            if (next !== sessionId) {
                sessionId = next;
                client.clear();
            }
        });
    }, [client]);

    return createElement(QueryClientProvider, { client }, children);
};
