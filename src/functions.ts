import { ListenerOptions, lookupEntityTuple, startDocListener, validateKey, validatePath } from "./common";
import { EntityApi } from "./EntityApi";
import { EntityClient, claimLease, putEntity, removeLeaseeFromLease } from "./EntityClient";
import { AUTH_USER } from "./hooks";
import { Lease } from "./Lease";
import { EntityCache, EntityKey, EntityTuple, LeaseOptions, PathElement } from "./types";
import { hashEntityKey } from "./util";


/**
 * A function that creates a listener for a given document. This function is idempotent: you
 * can call it multiple times with the same arguments, but a listener will be created only on
 * the first call.
 * @param leasee The name of the leasee that is claiming a lease on the watched entity
 * @param path The path to the document to be watched. If any element of the path is `undefined`,
 *      this function does nothing and returns `[idle, undefined, undefined]`.
 * @param options An object encapsulating optional arguments. This object may contain any of the
 *  the following fields:
 *      - `transform`: A function that transforms the raw data to its final form for storage in the local cache.
 *              This function receives three arguments:  a `LeaseeClient`, the raw data value from the 
 *              Firestore document and the path to the document expressed as string array. The function returns 
 *              the final (transformed) data value for storage in the local cache.
 *      - `onRemove`: A callback invoked when the document is removed from Firestore. This function receives three 
 *              arguments:  a `LeaseeClient`, the raw data value from the Firestore document and the path to the 
 *              document expressed as string array. The function has no return value.
 *      - `onError`: A callback invoked if an error occurred while listening to the Firestore document. This
 *              function receives two arguments: a `LeaseeClient`, the `Error` thrown by Firestore and the path
 *              to the document expressed as string array. The function has no return value.
 *      - `leaseOptions`: An object of type `LeaseOptions` encapsulating options for the lease that will be 
 *              created when the data value is stored in the local cache.
 * 
 * @returns A Tuple describing the entity being watched. This tuple contains three elements:
 *      - The entity status ('idle', 'pending', 'success', or 'error')
 *      - The current data value which may be `null` or `undefined`
 *      - An `Error` object if the status is `error`.
 */
export function watchEntity<
    TRaw = unknown,
    TFinal = TRaw
>(
    client: EntityClient,
    leasee: string,
    path: PathElement[],
    options?: ListenerOptions<TRaw, TFinal>
) {
    const validPath = validatePath(path);
    const hashValue = validPath ? hashEntityKey(path) : "";

    startDocListener(leasee, validPath, hashValue, options);

    return lookupEntityTuple<TFinal>(client.cache, hashValue);
}


function toHashValue(key: string | EntityKey) {
    if (typeof(key) === 'string') {
        return key;
    }
    const validKey = validateKey(key);
    return validKey ? hashEntityKey(key) : null;
}

/**
 * Insert or update the data value for some entity in the local cache.
 * This function also creates or updates the caller's lease for that entity.
 * @param client The EntityClient that provides access to the local cache
 * @param leasee The name of the leasee claiming a lease on the entity
 * @param key The key under which the entity shall be stored
 * @param value The data value to be stored in the local cache
 * @param options An object containing the following optional configuration parameters
 *  for the caller's lease...
 *      - `cacheTime`: The minimum number of milliseconds that an abandoned entity can live in the cache.
 *              An abandoned entity is one that has no leasees. Set `cacheTime` to `Number.POSITIVE_INFINITY`
 *              if you want the entity to remain in the cache indefinitely.
 */
export function setLeasedEntity(
    client: EntityClient, 
    leasee: string, 
    key: string | EntityKey, 
    value: unknown, 
    options?: LeaseOptions
) {

    const hashValue = toHashValue(key);
    if (hashValue) {
        putEntity(client, hashValue, value);
        let lease = client.leases.get(hashValue);
        if (!lease) {
            lease = new Lease(hashValue);
            client.leases.set(hashValue, lease);
        }
        claimLease(client, hashValue, leasee, options);
    }
}

export function getAuthUser<Type>(client: EntityClient | EntityApi | Object) {
    return getEntity<Type>(client, AUTH_USER);
}

export function setAuthUser(client: EntityClient, value: unknown) {
    putEntity(client, AUTH_USER, value);
}

function resolveCache(value: Object) {
    return (
        value.hasOwnProperty('cache') ? (value as EntityClient).cache :
        (value as any).getClient ? (value as EntityApi).getClient().cache :
        value as EntityCache
    )
}


/**
 * Get a tuple describing an entity in the local cache.
 * @param clientOrCache The client that provides access to the cache, or the cache itself
 * @param entityKey The key under which the entity is stored in the cache
 * @returns A tuple describing the requested entity.
 */
export function getEntity<Type>(clientOrCache: EntityClient | EntityApi | Object, key: string | EntityKey) {
    const hashValue = toHashValue(key);
    const cache = resolveCache(clientOrCache);
    return lookupEntityTuple<Type>(cache, hashValue);
}

export function getClientState<T>(client: EntityClient) {
    return client.cache as T
}

export interface TypedClientStateGetter<T> {
    (client: EntityClient): T
}


/**
 * Get a specific entity from the cache, and start a document listener
 * if the entity is not found in the cache. This function is 
 * similar to the `useDocListener` hook, but it is designed for use in
 * event handlers (including HTML DOM events and events triggered by 
 * other document listeners).
 * 
 * This function has two generic type parameters:
 *  - `TRaw`: The type of the data object in Firestore
 *  - `TFinal`: The final type of the entity if a transform is applied
 * 
 * @param client The EntityClient that is managing entities
 * @param leasee The name of the leasee making a claim on the entity
 * @param path The path the document in Firestore
 * @param options Options for managaging the entity. This argument is an object 
 *  with the following optional properties:
 *      - transform: A function that transforms raw data from Firestore into a 
 *          a different structure.  This function has the form 
 *          `(client: LeaseeClient, value: TRaw) => TFinal` 
 *      - onRemove: A callback that fires when the listener reports that the Firestore
 *          document has been removed. The callback has the form
 *          `(client: LeaseeClient, data: TRaw) => void`
 * @returns An EntityTuple describing the requested entity
 */
export function fetchEntity<TRaw = unknown, TFinal = TRaw>(
    client: EntityClient,
    leasee: string,
    path: PathElement[], 
    options?: ListenerOptions<TRaw, TFinal>
) : EntityTuple<TFinal> {

    const validPath = validatePath(path);
    const hashValue = validPath ? hashEntityKey(validPath) : '';
    startDocListener<TRaw, TFinal>(
        leasee, validPath, hashValue, options
    )

    return lookupEntityTuple<TFinal>(client.cache, hashValue);
}

/**
 * Release the claim that a leasee has on a specific entity within the local cache
 * @param client EntityClient The EntityClient that manages leases and entities
 * @param leasee The name of the leasee
 * @param key The EntityKey under which the entity is stored in the local cache
 */
export function releaseClaim(client: EntityClient, leasee: string, key: EntityKey) {

    if (validateKey(key)) {
        const hashValue = hashEntityKey(key);
        const lease = client.leases.get(hashValue);
        if (lease) {
            removeLeaseeFromLease(client, lease, leasee);
            const leaseeLeases = client.leaseeLeases;
            const set = leaseeLeases.get(leasee);
            if (set) {
                set.delete(lease);
                if (set.size === 0) {
                    leaseeLeases.delete(leasee);
                }
            }
        }
    }
}


export function disownAllLeases(api: EntityApi, leasee: string) {
    api.getClient().disownAllLeases(leasee);
}

