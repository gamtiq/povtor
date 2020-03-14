export declare type RetryAction = (...args: unknown[]) => Promise<unknown> | unknown;
export declare type RetryTest = (value: unknown) => boolean;
export interface RetrySettings {
    action: RetryAction;
    actionContext?: unknown;
    actionParams?: unknown[];
    delay?: number;
    retryAttempts?: number[];
    retryQty?: number;
    retryTimeout?: number;
    retryOnError?: boolean | RetryTest;
    retryTest?: boolean | RetryTest;
}
export interface WithPromiseField {
    promise: Promise<unknown>;
}
export interface RetryResult extends WithPromiseField {
    attempt: number;
    error: unknown;
    stop: () => Promise<unknown>;
    stopped: boolean;
    value: unknown;
    valueWait: boolean;
    wait: boolean;
}
export declare function retry(settings: RetrySettings): RetryResult;
export declare function getPromiseField(obj: WithPromiseField): Promise<unknown>;
