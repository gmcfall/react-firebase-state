import { collection, documentId, getFirestore, onSnapshot, query, where } from "firebase/firestore";
import produce from 'immer';
import { EntityApi } from "./EntityApi";
import { claimLease, createLeasedEntity } from "./EntityClient";
import { LeaseeApi } from "./LeaseeApi";
import { setEntity } from "./setEntity";
import { AuthTuple, Cache, EntityTuple, LeaseOptions, PathElement } from "./types";

/** The key under which the authenticated user is stored in the EntityCache */
export const CURRENT_USER = 'currentUser';

export function validatePath(path: PathElement[]) {
    for (const value of path) {
        
        if (value===undefined) {
            return null;
        }
    }

    return path as string[];
}

/**
 * A specialized error that occurs if the user signed in with an identity provider
 * that is incompatible with the identity provider used during registration.
 * Two identity providers are incompatible if they instantiate users with different
 * Firestore `uid` values.
 */
export class IncompatibleIdentityProviderError extends Error {
    constructor(message?: string) {
        super(message || 'An incompatible identity provider was used to sign in');
    }
}


/**
 * Options passed to the [useDocListener](../functions/useDocListener.html) hook.
 * 
 * @typeParam TServer The type of data stored in the Firebase document.
 * @typeParam TFinal The type of data returned by the `transform` handler, if any.
 *      If no `transform` handler is defined, this template parameter defaults to 
 *      the `TServer` type.
 */
export interface DocListenerOptions<TServer, TFinal=TServer> {
    transform?: (api: LeaseeApi, serverData: TServer, path: string[]) => TFinal;
    onRemove?: (api: LeaseeApi, serverData: TServer, path: string[]) => void;
    onError?: (api: LeaseeApi, error: Error, path: string[]) => void;
    leaseOptions?: LeaseOptions;
}

export function startDocListener<
    TRaw = unknown, // The raw type stored in Firestore
    TFinal = TRaw,  // The final type, if a transform is applied
> (
    entityApi: EntityApi,
    leasee: string,
    validPath: string[] | null,
    hashValue: string,
    options?: DocListenerOptions<TRaw, TFinal>
) {
    if (!validPath) {
        return;
    }

    

    const lease = entityApi.getClient().leases.get(hashValue);
    const unsubscribe = lease?.unsubscribe;


    const leaseOptions = options?.leaseOptions;
    if (unsubscribe) {
        claimLease(entityApi.getClient(), hashValue, leasee, leaseOptions);
    } else { 
        
        const transform = options?.transform;
        const onRemove = options?.onRemove;

        
        const collectionName = validPath[0];
        const collectionKeys = validPath.slice(1, validPath.length-1);
        const docId = validPath[validPath.length-1];
        const db = getFirestore(entityApi.getClient().firebaseApp);
        const collectionRef = collection(db, collectionName, ...collectionKeys);
    
        const q = query(collectionRef, where(documentId(), "==", docId));

        const unsubscribe = onSnapshot(q, snapshot => {

            snapshot.docChanges().forEach(change => {
                switch (change.type) {
                    case 'added':
                    case 'modified': {
                        const data = change.doc.data() as TRaw;

                        try {
                            const finalData = transform ?
                                transform(new LeaseeApi(leasee, entityApi), data, validPath) :
                                data;
    
                            setEntity(entityApi, hashValue, finalData);
                        } catch (transformError) {
                            setEntity(entityApi, hashValue, transformError);
                        }

                        break;
                    }
                    case 'removed': {

                        setEntity(entityApi, hashValue, null);
                        if (onRemove) {
                            const data = change.doc.data() as TRaw;
                            onRemove(new LeaseeApi(leasee, entityApi), data, validPath);
                        }
                        break;
                    }
                }
            })
        }, error => {

            setEntity(entityApi, hashValue, error);

            const onError = options?.onError;
            if (onError) {
                onError(new LeaseeApi(leasee, entityApi), error, validPath);
            }

            
        })

        createLeasedEntity(entityApi.getClient(), unsubscribe, hashValue, leasee, options?.leaseOptions);
    }

}

export function lookupAuthTuple<UserType>(cache: Cache): AuthTuple<UserType> {
    const entity = cache[CURRENT_USER];
    
    return (
        entity===undefined      ? [undefined, undefined, 'pending'] :
        entity===null           ? [null, undefined, 'signedOut'] :
        entity instanceof Error ? [undefined, entity as Error, 'error'] :
                                  [entity as UserType, undefined, 'signedIn']
    )
}

export function lookupEntityTuple<T>(cache: Cache, key: string | null) : EntityTuple<T> {
    const value = key === null ? undefined : cache[key];
    return (
        ((value===undefined && (key===null || !cache.hasOwnProperty(key))) && [undefined, undefined, "idle"]) ||
        (value===undefined && [undefined, undefined, "pending"]) ||
        (value instanceof Error && [undefined, value as Error, "error"]) ||
        (value===null && [null, undefined, "removed"]) ||
        [value as T, undefined, "success"]
    )
}
