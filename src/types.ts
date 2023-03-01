import { User } from "firebase/auth";
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

export type PathElement = string | undefined;

export type Unsubscribe = () => void;

/**
 * The local cache managed by the [EntityApi](../interfaces/EntityApi.html).
 * For more information about the cache, see also [Lease](../classes/Lease.html)
 */
export type Cache = Record<string, Entity>;

/**
 * A key for an entity consisting of an array of `unknown` values.
 * 
 * The current version of the `react-firebase-state` library
 * only uses `EntityKey`s given by an array of strings that
 * represent the path to a document in Firestore.
 * 
 * More general types of keys may be used in the future to support
 * Firebase query listeners.
 */
export type EntityKey = readonly unknown[];

/**
 * The base interface for all events supported by
 * the `react-firebase-state` library.
 */
export interface ReactFirebaseEvent {
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
}

/**
 * The base interface for events that fire while listening for changes
 * to a given Firestore document.
 */
export interface DocEvent extends ReactFirebaseEvent {

    /** 
     * The path to the document in Firestore.
     * 
     * See [Entity Keys](../interfaces/EntityApi.html#entity-keys) for a discussion 
     * about document paths.
     */
    path: string[];
}

/**
 * The base interface for events that describe a change to a Firestore document.
 * 
 * @typeParam ServerType The type of data stored in the document
 */
export interface DocMutationEvent<ServerType> extends DocEvent {

    /**
     * The [DocumentChange](https://firebase.google.com/docs/reference/kotlin/com/google/firebase/firestore/DocumentChange) 
     * received by the document listener.
     */
    change: DocumentChange<DocumentData>;

    /** The document data cast to the ServerType */
    data: ServerType;
}

/**
 * An event that fires when a document listener first receives the document from
 * Firestore and later when changes are made to the document.
 * 
 * Handlers for this event are set via the [transform](./DocListenerOptions.html#transform)
 * property of [DocListenerOptions](./DocListenerOptions.html).
 * 
 * @typeParam ServerType The type of data stored in the Firestore document
 */
export interface DocChangeEvent<ServerType> extends DocMutationEvent<ServerType> {

}

/** 
 * An event that fires when a document is removed from Firestore.
 * 
 * Handlers for this event are set via the [onRemoved](./DocListenerOptions.html#onRemoved)
 * property of [DocListenerOptions](./DocListenerOptions.html).
 * 
 * @typeParam ServerType The type of data stored in the Firestore document
 */
export interface DocRemovedEvent<ServerType> extends DocMutationEvent<ServerType> {

}

/**
 * An event that fires when the state of the current user changes
 * 
 * Handlers for this event are set via the [transform](./AuthOptions.html#transform)
 * property of the [AuthOptions](./AuthOptions.html) interface.
 */
export interface UserChangeEvent extends ReactFirebaseEvent {

    /**
     * The user whose state changed
     */
    user: User;
}

/**
 * An event that fires when it is known that the user is signed out.
 * There are two scenarios when this event fires:
 * 1. When the auth listener starts up and determines that the user is not signed in.
 * 2. When the user explicitly signs out.
 * 
 * Handlers for this event are set via the [onSignedOut](./AuthOptions.html#onSignedOut) property
 * of the [AuthOptions](./AuthOptions.html) interface.
 */
export interface UserSignedOutEvent extends ReactFirebaseEvent {

}

/**
 * An event that fires if the Auth listener encounters an error
 * while listening for user state changes.
 * 
 * Handlers for this event are defined by the  [onError](./AuthOptions.html#onError)
 * property of the [AuthOptions](./AuthOptions.html) interface.
 */
export interface AuthErrorEvent extends ReactFirebaseEvent {
    /** The error that occurred */
    error: Error;
}

/**
 * An event that fires if the document listener receives an error
 * while fetching a document from Firestore.
 * 
 * Handlers for this event are defined by the [onError](./DocListenerOptions.html#onError)
 * property of the [DocListenerOptions](./DocListenerOptions.html) interface.
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
 * Options for configuring the [EntityApi](./EntityApi.html)
 * Currently, these options consist of default values used when configuring
 * Leases.
 */
export interface EntityApiOptions extends LeaseOptions {

}

export interface ErrorInfo {
    message: string;
    error?: Error
}



