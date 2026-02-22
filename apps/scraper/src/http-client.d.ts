export interface HttpClientOptions {
    delayMs?: number;
    maxRetries?: number;
    maxConcurrency?: number;
}
export declare class HttpClient {
    private options;
    private lastRequestTime;
    private activeRequests;
    constructor(options?: HttpClientOptions);
    fetchPage(url: string, extraHeaders?: Record<string, string>): Promise<string>;
    private waitForSlot;
    private fetchWithRetry;
    private sleep;
}
//# sourceMappingURL=http-client.d.ts.map