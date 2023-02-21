import { collection, documentId, getFirestore, onSnapshot, query, where } from "firebase/firestore";
import produce from 'immer';
import { EntityClient, claimLease, createLeasedEntity } from "./EntityClient";
import { entityApi } from "./components/FirebaseContext/FirebaseContext";
import { LeaseeApi } from "./LeaseeApi";
import { Entity, EntityCache, EntityKey, EntityTuple, LeaseOptions, PathElement } from "./types";
import { hashEntityKey } from "./util";
import { setEntity } from "./setEntity";

export function validatePath(path: PathElement[]) {
    for (const value of path) {
        
        if (value===undefined) {
            return null;
        }
    }

    return path as string[];
}

export function validateKey(key: EntityKey) {
    if (!key) {
        return null;
    }
    for (const value of key) {
       if (!isValid(value)) {
        return null;
       }
    }
    return key;
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

function isValid(value: unknown) {

    if (value === undefined) {
        return false;
    }

    if (typeof value === 'object') {
        if (value) {
            const obj = value as any;
            for (const key in obj) {
                if (!isValid(obj[key])) {
                    return false;
                }
            }
        }
    }
    

    return true;
}


export interface ListenerOptions<TRaw, TFinal=TRaw> {
    transform?: (api: LeaseeApi, value: TRaw, path: string[]) => TFinal;
    onRemove?: (api: LeaseeApi, value: TRaw, path: string[]) => void;
    onError?: (api: LeaseeApi, error: Error, path: string[]) => void;
    leaseOptions?: LeaseOptions;
}

export function startDocListener<
    TRaw = unknown, // The raw type stored in Firestore
    TFinal = TRaw,  // The final type, if a transform is applied
> (
    leasee: string,
    validPath: string[] | null,
    hashValue: string,
    options?: ListenerOptions<TRaw, TFinal>
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

                        const finalData = transform ?
                            transform(new LeaseeApi(leasee, entityApi), data, validPath) :
                            data;

                        setEntity(entityApi, hashValue, finalData);
                        break;
                    }
                    case 'removed': {
                        entityApi.getClient().setCache(
                            (currentCache: EntityCache) => {
                                const nextCache = produce(currentCache, draftCache => {
                                    setEntity(entityApi, hashValue, null);
                                    if (onRemove) {
                                        const data = change.doc.data() as TRaw;
                                        onRemove(new LeaseeApi(leasee, entityApi), data, validPath);
                                    }
                                })

                                return nextCache;
                            }
                        )
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

export function lookupEntityTuple<T>(cache: EntityCache, key: string | null) : EntityTuple<T> {
    const value = key === null ? undefined : cache[key];
    return (
        ((value===undefined && (key===null || !cache.hasOwnProperty(key))) && ["idle", undefined, undefined]) ||
        (value===undefined && ["pending", undefined, undefined]) ||
        (value instanceof Error && ["error", undefined, value as Error]) ||
        (value===null && ["removed", null, undefined]) ||
        ["success", value as T, undefined]
    )
}
