export declare type RetryAction = (...args: any[]) => Promise<any> | any;
export declare type RetryTest = (value: any) => boolean;
export interface RetrySettings {
    action: RetryAction;
    actionContext?: any;
    actionParams?: any[];
    delay?: number;
    retryAttempts?: number[];
    retryQty?: number;
    retryTimeout?: number;
    retryOnError?: boolean | RetryTest;
    retryTest?: boolean | RetryTest;
}
export interface WithPromiseField {
    promise: Promise<any>;
}
export interface RetryResult extends WithPromiseField {
    attempt: number;
    error: any;
    stop: () => Promise<any>;
    stopped: boolean;
    value: any;
    valueWait: boolean;
    wait: boolean;
}
export declare function retry(settings: RetrySettings): RetryResult;
export declare function getPromiseField(obj: WithPromiseField): Promise<any>;
