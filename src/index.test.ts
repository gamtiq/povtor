import { retry, ErrorResult, RetryResult, ValueResult } from './index';

/* eslint-disable @typescript-eslint/no-magic-numbers */

describe('retry', () => {
    let undef;

    function getAction(value, timeout?: number): () => Promise<number> {
        return function action(): Promise<number> {
            return timeout
                ? new Promise((resolve) => {
                    // eslint-disable-next-line no-param-reassign
                    setTimeout(() => resolve(value++), timeout);
                })
                // eslint-disable-next-line no-param-reassign
                : Promise.resolve(value++);
        };
    }

    function getLessTest(max): (value: number) => boolean {
        return function lessTest(value): boolean {
            return value < max;
        };
    }

    it('should call action only once', () => {
        const num = 3;
        const result = retry({
            action: getAction(num),
            retryTest: getLessTest(num),
            retryQty: 200
        });

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( 1 );
            expect( value )
                .toBe( num );
            expect( result.value )
                .toBe( value );
            expect( result.error )
                .toBe( undef );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( 1 );
            expect( (result.result[0] as ValueResult).value )
                .toBe( value );
            expect( result.valueWait )
                .toBe( false );
            expect( result.wait )
                .toBe( false );
        });
    });

    it('should call action specified number of times', () => {
        const retryQty = 7;
        const settings = {
            action: getAction(1),
            retryTest: getLessTest(1000),
            retryQty,
            data: {
                test: 'value'
            }
        };
        const result = retry(settings);

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( retryQty + 1 );
            expect( result.value )
                .toBe( value );
            expect( result.error )
                .toBe( undef );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( retryQty + 1 );
            expect( result.settings )
                .toBe( settings );
            expect( result.valueWait )
                .toBe( false );
            expect( result.wait )
                .toBe( false );
        });
    });

    it('should call action first time after delay', () => {
        const num = 10;
        const delay = 200;
        const retryQty = 2;
        const startTime = new Date().getTime();
        const result = retry({
            action: getAction(num),
            retryTest: getLessTest(num + 100),
            retryQty,
            delay
        });

        return result.promise.then((value) => {
            expect( new Date().getTime() - startTime )
                .toBeGreaterThanOrEqual( delay );
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( num + retryQty );
            expect( result.value )
                .toBe( value );
        });
    });

    it('should retry action calls after delay', () => {
        const num = 4;
        const delay = 100;
        const retryTimeout = 200;
        const retryQty = 2;
        const startTime = new Date().getTime();
        const result = retry({
            action: getAction(num),
            retryTest: getLessTest(num + 100),
            retryQty,
            retryTimeout,
            delay
        });

        return result.promise.then((value) => {
            expect( new Date().getTime() - startTime )
                .toBeGreaterThanOrEqual( delay + (retryQty * retryTimeout) );
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( num + retryQty );
            expect( result.value )
                .toBe( value );
        });
    });

    it('should retry action calls after specified timeouts', () => {
        function timeout(res: RetryResult): number {
            return (res.settings.secondTimeout as number);
        }

        const num = 1;
        const delay = 100;
        const retryAttempts = [100, timeout, 300];
        const retryQty = retryAttempts.length;
        const startTime = new Date().getTime();
        const result = retry({
            action: getAction(num),
            retryTest: getLessTest(num + 100),
            retryAttempts,
            delay,
            secondTimeout: 200
        });

        return result.promise.then((value) => {
            expect( new Date().getTime() - startTime )
                .toBeGreaterThanOrEqual(
                    delay + (retryAttempts.reduce(
                        // eslint-disable-next-line multiline-ternary
                        (sum: number, val) => sum + (typeof val === 'function' ? val(result) : val),
                        0
                    ) as number)
                );
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( num + retryQty );
            expect( result.value )
                .toBe( value );
        });
    });

    it('should stop repeating of action calls when function from retryAttempts returns false', () => {
        function retryTimeout(): false {
            return false;
        }

        const start = 10;
        const result = retry({
            action: getAction(start),
            retryTest: true,
            retryAttempts: [100, retryTimeout, 200, 300, 400]
        });

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( 2 );
            expect( value )
                .toBe( start + 1 );
            expect( result.value )
                .toBe( value );
        });
    });

    it('should repeat action calls after timeout returned by function', () => {
        const timeoutList: number[] = [];

        function retryTimeout(res: RetryResult): number {
            const timeout = res.attempt * 100;
            timeoutList.push(timeout);

            return timeout;
        }

        const retryQty = 3;
        const result = retry({
            action: getAction(0),
            retryTest: true,
            retryQty,
            retryTimeout
        });

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( retryQty );
            expect( result.value )
                .toBe( value );
            expect( timeoutList )
                .toEqual( [100, 200, 300] );
        });
    });

    it('should stop repeating of action calls when retryTimeout function returns false', () => {
        const callLimit = 5;

        function retryTimeout(res: RetryResult): number | false {
            return res.attempt < res.settings.callLimit
                ? 100
                : false;
        }

        const result = retry({
            action: getAction(0),
            retryTest: true,
            retryTimeout,
            callLimit
        });

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( callLimit );
            expect( value )
                .toBe( callLimit - 1 );
            expect( result.value )
                .toBe( value );
        });
    });

    it('should repeat action calls depending on action result', () => {
        const start = 123;
        let num = start;
        const attemptQty = 3;
        const max = start + attemptQty;
        const result = retry({
            action: () => ++num,
            retryTest: (value: number, res: RetryResult) => value < res.settings.max,
            retryQty: -1,
            retryTimeout: -1,
            max
        });

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( attemptQty );
            expect( value )
                .toBe( max );
            expect( result.value )
                .toBe( value );
        });
    });

    it('should call action with context and parameters', () => {
        const obj = {
            value: 0,
            change(getChange: () => number): Promise<number> {
                return Promise.resolve( this.value += getChange() );
            }
        };
        const retryQty = 3;
        const result = retry({
            // eslint-disable-next-line @typescript-eslint/unbound-method
            action: obj.change,
            actionContext: obj,
            actionParams: [
                function getChange(): number {
                    return result.attempt * 2;
                }
            ],
            retryTest: getLessTest(1000),
            retryQty,
            delay: 0
        });

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( obj.value );
            expect( value )
                .toBe( 2 + 4 + 6 + 8 );
            expect( result.value )
                .toBe( value );
        });
    });

    it('should not retry action calls on promise rejection', () => {
        const reason = 'Test rejection';
        const result = retry({
            action: () => Promise.reject(reason),
            retryTest: () => true,
            retryQty: 100
        });

        // eslint-disable-next-line dot-notation
        return result.promise.catch((value) => {
            expect( result.attempt )
                .toBe( 1 );
            expect( value )
                .toBe( reason );
            expect( result.error )
                .toBe( value );
            expect( result.value )
                .toBe( undef );
            expect( result.isError )
                .toBe( true );
            expect( result.result.length )
                .toBe( 1 );
            expect( (result.result[0] as ErrorResult).error )
                .toBe( reason );
            expect( result.valueWait )
                .toBe( false );
            expect( result.wait )
                .toBe( false );
        });
    });

    it('should retry action calls on promise rejection', () => {
        const reason = 'Test rejection';
        const retryQty = 2;
        const result = retry({
            action: () => Promise.reject(reason),
            retryQty,
            retryOnError: true
        });

        // eslint-disable-next-line dot-notation
        return result.promise.catch((value) => {
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( reason );
            expect( result.error )
                .toBe( value );
            expect( result.value )
                .toBe( undef );
            expect( result.isError )
                .toBe( true );
            expect( result.result.length )
                .toBe( retryQty + 1 );
            expect( result.valueWait )
                .toBe( false );
            expect( result.wait )
                .toBe( false );

            for (const callResult of result.result) {
                expect( (callResult as ErrorResult).error )
                    .toBe( reason );
            }
        });
    });

    it('should retry action calls on promise rejection depending on condition', () => {
        const maxLen = 3;
        const msg = '!';
        let reason = '';
        const result = retry({
            action: () => Promise.reject(reason += msg),
            retryQty: -1,
            retryOnError: (value: string, res: RetryResult) => value.length < res.settings.maxLen,
            maxLen
        });

        // eslint-disable-next-line dot-notation
        return result.promise.catch((value) => {
            expect( result.attempt )
                .toBe( maxLen );
            expect( value )
                .toBe( reason );
            expect( value )
                .toBe( msg.repeat(maxLen) );
            expect( result.error )
                .toBe( value );
            expect( result.value )
                .toBe( undef );
            expect( result.isError )
                .toBe( true );
            expect( result.result.length )
                .toBe( maxLen );

            const callResultList = result.result;
            for (let i = 0, len = callResultList.length; i < len; i++) {
                expect( (callResultList[i] as ErrorResult).error )
                    .toBe( msg.repeat(i + 1) );
            }
        });
    });

    it('should retry action calls on action exception depending on condition', () => {
        const maxLen = 4;
        const msg = '!';
        let reason = '';
        const result = retry({
            action: () => {
                throw new Error(reason += msg);
            },
            retryQty: 500,
            retryOnError: (err: Error) => err.message.length < maxLen
        });

        // eslint-disable-next-line dot-notation
        return result.promise.catch((value: Error) => {
            expect( result.attempt )
                .toBe( maxLen );
            expect( value )
                .toBeInstanceOf( Error );
            expect( value.message )
                .toBe( reason );
            expect( reason )
                .toBe( msg.repeat(maxLen) );
            expect( result.error )
                .toBe( value );
            expect( result.value )
                .toBe( undef );
            expect( result.isError )
                .toBe( true );
            expect( result.result.length )
                .toBe( maxLen );

            const callResultList = result.result;
            for (let i = 0, len = callResultList.length; i < len; i++) {
                expect( ((callResultList[i] as ErrorResult).error as Error).message )
                    .toBe( msg.repeat(i + 1) );
            }
        });
    });

    it('result should contain last value and last error', () => {
        const retryQty = 5;
        let qty = 0;
        const result = retry({
            action: () => {
                qty++;

                return qty % 2 === 1
                    ? Promise.resolve(qty)
                    : Promise.reject(-qty);
            },
            retryQty,
            retryTest: true,
            retryOnError: true
        });

        // eslint-disable-next-line dot-notation
        return result.promise.catch((value) => {
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( -qty );
            expect( qty )
                .toBe( retryQty + 1 );
            expect( result.value )
                .toBe( qty - 1 );
            expect( result.error )
                .toBe( value );
            expect( result.isError )
                .toBe( true );
            expect( result.result.length )
                .toBe( retryQty + 1 );

            const callResultList = result.result;
            for (let i = 0, len = callResultList.length; i < len; i++) {
                const callResult = callResultList[i];
                const val = i + 1;
                if (val % 2 === 1) {
                    expect( (callResult as ValueResult).value )
                        .toBe( val );
                }
                else {
                    expect( (callResult as ErrorResult).error )
                        .toBe( -val );
                }
            }
        });
    });

    it('should stop repetition of async action calls', (done) => {
        const num = 7;
        const result = retry({
            action: getAction(num, 100),
            retryTest: true,
            retryQty: -123
        });
        let qty: number, val: number;

        expect( result.stopped )
            .toBe( false );

        setTimeout(() => {
            qty = result.attempt;
            val = num + qty - 2;

            expect( qty )
                .toBe( 3 );
            expect( result.value )
                .toBe( val );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( qty - 1 );
            expect( result.stopped )
                .toBe( false );
            expect( result.wait )
                .toBe( false );
            expect( result.valueWait )
                .toBe( true );

            expect( result.stop() )
                .toBe( result.promise );

            expect( result.value )
                .toBe( val );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( qty - 1 );
            expect( result.stopped )
                .toBe( true );
            expect( result.wait )
                .toBe( false );
            expect( result.valueWait )
                .toBe( true );
        }, 250);

        setTimeout(() => {
            expect( result.attempt )
                .toBe( qty );
            expect( result.value )
                .toBe( val + 1 );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( qty );
            expect( result.stopped )
                .toBe( true );
            expect( result.wait )
                .toBe( false );
            expect( result.valueWait )
                .toBe( false );
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            result.promise.then((value) => {
                expect( result.stop() )
                    .toBe( result.promise );
                expect( result.value )
                    .toBe( value );
                expect( value )
                    .toBe( val + 1 );

                done();
            });
        }, 450);
    });

    it('should stop repetition of action calls', (done) => {
        const start = 9;
        let num = start;
        const result = retry({
            action: () => ++num,
            retryTest: true,
            retryQty: 400,
            retryTimeout: 100
        });
        let qty: number, val;

        expect( result.stopped )
            .toBe( false );

        setTimeout(() => {
            qty = result.attempt;
            val = start + qty;

            expect( qty )
                .toBe( 3 );
            expect( result.value )
                .toBe( val );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( qty );
            expect( result.stopped )
                .toBe( false );
            expect( result.wait )
                .toBe( true );
            expect( result.valueWait )
                .toBe( false );

            expect( result.stop() )
                .toBe( result.promise );

            expect( result.value )
                .toBe( val );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( qty );
            expect( result.stopped )
                .toBe( true );
            expect( result.wait )
                .toBe( false );
            expect( result.valueWait )
                .toBe( false );
        }, 250);

        setTimeout(() => {
            expect( result.attempt )
                .toBe( qty );
            expect( result.value )
                .toBe( val );
            expect( result.isError )
                .toBe( false );
            expect( result.result.length )
                .toBe( qty );
            expect( result.stopped )
                .toBe( true );
            expect( result.wait )
                .toBe( false );
            expect( result.valueWait )
                .toBe( false );
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            result.promise.then((value) => {
                expect( result.stop() )
                    .toBe( result.promise );
                expect( result.value )
                    .toBe( value );
                expect( value )
                    .toBe( val );

                done();
            });
        }, 450);
    });
});
