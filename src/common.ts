import { collection, documentId, getFirestore, onSnapshot, query, where } from "firebase/firestore";
import { EntityApi } from "./EntityApi";
import { claimLease, createLeasedEntity } from "./EntityClient";
import { setEntity } from "./setEntity";
import { AuthTuple, Cache, DocChangeEvent, DocErrorEvent, EntityTuple, LeaseOptions, PathElement } from "./types";

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
 * Options passed to the [useDocListener](../functions/useDocListener.html) hook
 * and the [watchEntity](../functions/watchEntity.html) function.
 * 
 * @typeParam TServer The type of data stored in the Firebase document.
 * @typeParam TFinal The type of data returned by the `transform` handler, if any.
 *      If no `transform` handler is defined, this template parameter defaults to 
 *      the `TServer` type.
 */
export interface DocListenerOptions<TServer, TFinal=TServer> {

    /**
     * A kind of event handler that allows you to transform the
     * raw data received from a Firestore document into a different data shape for
     * use in your application. This event handler fires when the document is first
     * received from Firestore and again whenever data in the document is modified.
     * Unlike other event handlers, this one returns a value &ndash; the transformed
     * document data.
     * 
     * #### Example
     * Suppose a "city" document in Firestore looks like this:
     * ```javascript
     *  {
     *      cityName: "Liverpool",
     *      councillors: {
     *          UOcUt: {id: "UOcUt", name: "Pat Moloney",     ward: "Childwall"  },
     *          PxFNV: {id: "PxFNV", name: "Ellie Byrne",     ward: "Everton"    },
     *          vQwxK: {id: "vQwxK", name: "Lynnie Hinnigan", ward: "Cressington"}
     *      }
     *  }
     * ```
     * In this document, councillors are stored in a map indexed by the councillor’s id. 
     * Let’s suppose that a document having this structure matches the `ServerCity` type.
     * 
     * On the client, it might be more convenient to have the councillors in an array sorted 
     * by name as shown below:
     * ``` javascript
     *  {
     *     id: "dIjZC",
     *     cityName: "Liverpool",
     *     councillors: [
     *         {id: "PxFNV", name: "Ellie Byrne",     ward: "Everton"  },
     *         {id: "vQwxK", name: "Lynnie Hinnigan", ward: "Cressington"},
     *         {id: "UOcUt", name: "Pat Moloney"      ward: "Childwall"}
     *     ]
     * }
     * ```
     * A document having this structure matches the `ClientCity` type.
     * 
     * To convert a `ServerCity` into a `ClientCity`, we introduce the following 
     * transform handler.
     * ```typescript
     *  function cityTransform(event: DocChangeEvent<ServerCity>): ClientCity {
     *      const serverData = event.data;
     *      const path = event.path;
     *      const councillors = Object.values(serverData.councillors);
     *      councillors.sort( (a, b) => a.name.localeCompare(b.name) );
     * 
     *      return {
     *          id: path[path.length-1],
     *          cityName: serverData.cityName,
     *          councillors
     *      }
     *  }
     * ```
     * The application would then use `cityTransform` as the value of the `transform` handler.
     * 
     * @param event The event that fired
     * @typeParam TServer The type of data stored in the Firestore document
     * @returns The transformed data for storage within the cache, or `undefined` if
     *   the transformed structure relies on other server-side entities that are pending.
     * @throws The transform function may throw an Error if it is impossible to create
     *  the transformed structure due to missing or inconsistent data that it depends upon.
     *  That error will be stored in the cache.
     */
    transform?: (event: DocChangeEvent<TServer>) => TFinal | undefined;

    /**
     * An event handler that is called when a document is removed from Firestore
     * @param event The event that fired when the document was removed
     * @typeParam TServer The type of data stored in the Firestore document
     */
    onRemove?: (event: DocChangeEvent<TServer>) => void;

    /**
     * An event handler that is called if an error occurs while fetching
     * the document from Firestore.
     * @param event The event that fired when the error occurred
     */
    onError?: (event: DocErrorEvent) => void;

    /**
     * Options used to create a Lease for the document data.
     * A lease is created the first time that 
     * [useDocListener](../functions/useDocListener.html) is called with a given
     * `path` parameter and a document listener is started.
     * Subsequent calls to `useDocListener` with the same path will detect that
     * a document listener is running, and the `leaseOptions` will be ignored.
     */
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
                                transform({
                                    api:entityApi,
                                    leasee,
                                    data,
                                    path: validPath,
                                    change
                                }) :
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
                            onRemove({
                                api:entityApi,
                                leasee,
                                data,
                                path: validPath,
                                change
                            });
                        }
                        break;
                    }
                }
            })
        }, error => {

            setEntity(entityApi, hashValue, error);

            const onError = options?.onError;
            if (onError) {
                onError({
                    api:entityApi,
                    leasee,
                    path: validPath,
                    error
                });
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
