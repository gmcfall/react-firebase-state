import { DocumentChange, DocumentData } from "firebase/firestore";
import { EntityApi } from "./EntityApi";
import { Lease } from "./Lease";

export type Entity = unknown;


export type EntityStatus = 'idle' | 'pending' | 'success' | 'removed' | 'error';

export type IdleTuple = [undefined, undefined, 'idle'];
export type PendingTuple = [undefined, undefined, 'pending'];
export type SuccessTuple<T> = [T, undefined, 'success'];
export type ErrorTuple = [undefined, Error, 'error'];
export type RemovedTuple = [null, undefined, 'removed'];

export type EntityTuple<T> = (
    IdleTuple |
    PendingTuple |
    SuccessTuple<T> |
    ErrorTuple |
    RemovedTuple
)

export type AuthStatus = 'pending' | 'signedIn' | 'signedOut' | 'error';
export type SignedInTuple<UserType> = [UserType, undefined, 'signedIn'];
export type SignedOutTuple = [null, undefined, 'signedOut'];

export type AuthTuple<UserType> = (
    PendingTuple            |
    SignedInTuple<UserType> |
    SignedOutTuple          |
    ErrorTuple
)

export type AuthTupleOrIdle<UserType> = (
    AuthTuple<UserType> |
    IdleTuple
)

export type PathElement = string | undefined;

export type Unsubscribe = () => void;

export type Cache = Record<string, Entity>;

export type EntityKey = readonly unknown[];

/**
 * An event that fires while listening for changes
 * to a given Firestore document.
 */
export interface DocEvent {
    /**
     * The EntityApi instance
     */
    api: EntityApi;

    /**
     * The name of the component making a claim on the document data.
     * 
     * See {@link Lease} for a discussion about claims.
     */
    leasee: string;

    /** 
     * The path to the document in Firestore.
     * 
     * See [Entity Keys](../interfaces/EntityApi.html#entity-keys) for a discussion 
     * about document paths.
     */
    path: string[];
}

/**
 * An event describing a change to a Firestore document.
 * @typeParam ServerType The type of data stored in the document
 */
export interface DocChangeEvent<ServerType> extends DocEvent {

    /**
     * The [DocumentChange](https://firebase.google.com/docs/reference/kotlin/com/google/firebase/firestore/DocumentChange#type()) 
     * received by the document listener.
     */
    change: DocumentChange<DocumentData>;

    /** The document data cast to the ServerType */
    data: ServerType;
}

/**
 * An event that fires if the document listener receives an error
 * while fetching a document from Firestore.
 */
export interface DocErrorEvent extends DocEvent {

    /** The error thrown by Firestore */
    error: Error;

}

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



