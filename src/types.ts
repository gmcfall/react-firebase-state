import { Lease } from "./Lease";

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

export type Cache = Record<string, Entity>;

export type EntityKey = readonly unknown[];

/**
 * Options for configuring a [Lease](../classes/Lease.html)
 */
export interface LeaseOptions {

    /** 
     * The number of milliseconds that an abandoned entity can live in the cache.
     * For more information, see the discussion of abandoned entities in
     * the [Lease class documentation](../classes/Lease.html)
     */
    abandonTime?: number;
}
/**
 * Options for configuring the [EntityClient](../classes/EntityClient.html)
 * Currently, these options consist of default values used when configuring
 * Leases.
 */
export interface EntityClientOptions extends LeaseOptions {

}

export interface ErrorInfo {
    message: string;
    error?: Error
}



