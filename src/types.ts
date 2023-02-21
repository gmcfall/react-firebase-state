
export type Entity = unknown;


export type EntityStatus = 'idle' | 'pending' | 'success' | 'removed' | 'error';

export type IdleTuple = ['idle', undefined, undefined];
export type PendingTuple = ['pending', undefined, undefined];
export type SuccessTuple<T> = ['success', T, undefined];
export type ErrorTuple = ['error', undefined, Error];
export type RemovedTuple = ['removed', null, undefined];

export type EntityTuple<T> = (
    IdleTuple |
    PendingTuple |
    SuccessTuple<T> |
    ErrorTuple |
    RemovedTuple
)

export type AuthStatus = 'pending' | 'signedIn' | 'signedOut' | 'error';
export type SignedInTuple<UserType> = ['signedIn', UserType, undefined];
export type SignedOutTuple = ['signedOut', null, undefined];

export type AuthTuple<UserType> = (
    PendingTuple            |
    SignedInTuple<UserType> |
    SignedOutTuple          |
    ErrorTuple
)

export type PathElement = string | undefined;

export type Unsubscribe = () => void;

export type EntityCache = Record<string, Entity>;

export type EntityKey = readonly unknown[];

export interface EntityClientOptions {

    /** 
     * The minimum number of milliseconds that an abandoned entity can live in the cache.
     * An abandoned entity is one that has no leasees.
     */
    cacheTime: number;
}

export type LeaseOptions = Partial<EntityClientOptions>;

export interface ErrorInfo {
    message: string;
    error?: Error
}



