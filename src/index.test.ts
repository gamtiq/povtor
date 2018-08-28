import { retry } from './index';

describe('retry', () => {
    let undef;

    function getAction(value, timeout?: number) {
        return function action() {
            return timeout
                ? new Promise((resolve) => {
                    setTimeout(() => resolve(value++), timeout);
                })
                : Promise.resolve(value++);
        }
    }

    function getLessTest(max) {
        return function lessTest(value) {
            return value < max;
        }
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
            expect( result.valueWait )
                .toBe( false );
            expect( result.wait )
                .toBe( false );
        });
    });

    it('should call action specified number of times', () => {
        const retryQty = 7;
        const result = retry({
            action: getAction(1),
            retryTest: getLessTest(1000),
            retryQty
        });

        return result.promise.then((value) => {
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( retryQty + 1 );
            expect( result.value )
                .toBe( value );
            expect( result.error )
                .toBe( undef );
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
        const num = 1;
        const delay = 100;
        const retryAttempts = [100, 200, 300];
        const retryQty = retryAttempts.length;
        const startTime = new Date().getTime();
        const result = retry({
            action: getAction(num),
            retryTest: getLessTest(num + 100),
            retryAttempts,
            delay
        });

        return result.promise.then((value) => {
            expect( new Date().getTime() - startTime )
                .toBeGreaterThanOrEqual( delay + retryAttempts.reduce((sum, value) => sum + value, 0) );
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( num + retryQty );
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
            retryTest: getLessTest(max),
            retryQty: -1,
            retryTimeout: -1
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
            change(getChange) {
                return Promise.resolve( this.value += getChange() );
            }
        };
        const retryQty = 3;
        const result = retry({
            action: obj.change,
            actionContext: obj,
            actionParams: [
                function getChange() {
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

        return result.promise.catch((value) => {
            expect( result.attempt )
                .toBe( 1 );
            expect( value )
                .toBe( reason );
            expect( result.error )
                .toBe( value );
            expect( result.value )
                .toBe( undef );
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

        return result.promise.catch((value) => {
            expect( result.attempt )
                .toBe( retryQty + 1 );
            expect( value )
                .toBe( reason );
            expect( result.error )
                .toBe( value );
            expect( result.value )
                .toBe( undef );
            expect( result.valueWait )
                .toBe( false );
            expect( result.wait )
                .toBe( false );
        });
    });

    it('should retry action calls on promise rejection depending on condition', () => {
        const maxLen = 3;
        const msg = '!';
        let reason = '';
        const result = retry({
            action: () => Promise.reject(reason += msg),
            retryQty: -1,
            retryOnError: (reason) => reason.length < maxLen
        });

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
            retryOnError: (reason: Error) => reason.message.length < maxLen
        });

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
        });
    });

    it('should stop repetition of async action calls', (done) => {
        const num = 7;
        const result = retry({
            action: getAction(num, 100),
            retryTest: true,
            retryQty: -123
        });
        let qty, val;

        expect( result.stopped )
            .toBe( false );

        setTimeout(() => {
            qty = result.attempt;
            val = num + qty - 2;

            expect( qty )
                .toBe( 3 );
            expect( result.value )
                .toBe( val );
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
            expect( result.stopped )
                .toBe( true );
            expect( result.wait )
                .toBe( false );
            expect( result.valueWait )
                .toBe( false );
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
        let qty, val;

        expect( result.stopped )
            .toBe( false );

        setTimeout(() => {
            qty = result.attempt;
            val = start + qty;

            expect( qty )
                .toBe( 3 );
            expect( result.value )
                .toBe( val );
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
            expect( result.stopped )
                .toBe( true );
            expect( result.wait )
                .toBe( false );
            expect( result.valueWait )
                .toBe( false );
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
