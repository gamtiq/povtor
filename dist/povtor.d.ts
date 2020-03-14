export declare type RetryAction = (...args: unknown[]) => Promise<unknown> | unknown;
export declare type GetRetryTimeout = (result?: RetryResult) => unknown;
export declare type RetryTimeout = number | GetRetryTimeout;
export declare type RetryTest = (value?: unknown, result?: RetryResult) => boolean;
export interface RetrySettings {
    action: RetryAction;
    actionContext?: unknown;
    actionParams?: unknown[];
    delay?: number;
    retryAttempts?: RetryTimeout[];
    retryQty?: number;
    retryTimeout?: RetryTimeout;
    retryOnError?: boolean | RetryTest;
    retryTest?: boolean | RetryTest;
    [field: string]: unknown;
}
export interface ValueResult {
    time: number;
    value: unknown;
}
export interface ErrorResult {
    error: unknown;
    time: number;
}
export declare type ActionCallResult = ValueResult | ErrorResult;
export interface WithPromiseField {
    promise: Promise<unknown>;
}
export interface RetryResult extends WithPromiseField {
    attempt: number;
    error: unknown;
    isError: boolean;
    result: ActionCallResult[];
    settings: RetrySettings;
    stop: () => Promise<unknown>;
    stopped: boolean;
    value: unknown;
    valueWait: boolean;
    wait: boolean;
}
export declare function retry(settings: RetrySettings): RetryResult;
export declare function getPromiseField(obj: WithPromiseField): Promise<unknown>;
