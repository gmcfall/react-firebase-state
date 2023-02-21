import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useContext, useEffect } from "react";
import { ListenerOptions, lookupEntityTuple, startDocListener, validateKey, validatePath } from "./common";
import { EntityApi } from "./EntityApi";
import { EntityClient, createLeasedEntity, putEntity } from "./EntityClient";
import { entityApi, FirebaseContext } from "./components/FirebaseContext/FirebaseContext";
import { LeaseeApi } from "./LeaseeApi";
import { AuthTuple, EntityKey, EntityTuple, PathElement } from "./types";
import { hashEntityKey } from "./util";

/** The error message when useContext(FirebaseContext) returns `undefined` */
const OUTSIDE = "FirebaseContext was used outside of a provider";

/** The key under which the authenticated user is stored in the EntityCache */
export const AUTH_USER = 'authUser';

/** The lease options for the Firebase Auth user */
export const AUTH_USER_LEASE_OPTIONS = {cacheTime: Number.POSITIVE_INFINITY};

/**
 * Use a snapshot listener to retrieve data from a Firestore document.
 * @param leasee The name of the component that is leasing the data to be retrieved.
 * @param path The path to the document in Firestore, starting with the name of a collection.
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
 * @returns An array containing three elements. 
 *      - The first element is the status of the entity; one of "idle", "loading", "success", "error".
 *      - If the status is "success", the second element contains the entity data. Otherwise, the second
 *        element is `undefined`.
 *      - If the status is "error", the third element contains the Error object thrown while fetching
 *        processing the entity. Otherwise, the third element is `undefined`.
 */
export function useDocListener<
    TRaw = unknown, // The raw type stored in Firestore
    TFinal = TRaw,  // The final type, if a transform is applied
>(
    leasee: string,
    path: PathElement[],
    options?: ListenerOptions<TRaw, TFinal>
) : EntityTuple<TFinal> {

    const client = useContext(FirebaseContext);

    if (!client) {
        throw new Error(OUTSIDE)
    }

    const validPath = validatePath(path);
    const hashValue = validPath ? hashEntityKey(validPath) : '';

    useEffect( () => {
        startDocListener<TRaw, TFinal>(
            leasee, validPath, hashValue, options
        );

    }, [leasee, hashValue, client, validPath, options])

    return lookupEntityTuple<TFinal>(client.cache, hashValue);
}

/**
 * Options for managing Firebase Authentication
 */
export interface AuthOptions<Type=User> {
    /** A function that transforms the Firebase user into a different structure */
    transform?: (api: LeaseeApi, user: User) => Type | null | undefined;

    /** A callback that is invoked when it is known that the user is not signed in */
    onSignedOut?: () => void;
}


/**
 * 
 * @param options An object with the following properties:
 *      - `transform` A function that transforms the Firebase User into a new type.
 *        This function must have the form `(user: User) => Type | null` or 
 *        `(user: User) => Promise<Type | null>` where `Type` is the
 *        type of object to which the Firebase User has been transformed. The transform may
 *        force the user to signout, in which case it returns (or resolves) to null.
 *      - `onSignedOut` A callback that fires when it is known that the user is not signed in.
 *         This function takes no arguments and has no return value, so the signature of the 
 *         callback is `() => void`.
 */
export function useAuthListener<UserType = User>(options?: AuthOptions<UserType>) : AuthTuple<UserType> {

    const transform = options?.transform;
    const onSignedOut = options?.onSignedOut;

    const client = useContext(FirebaseContext);

    if (!client) {
        throw new Error(OUTSIDE);
    }

    useEffect(() => {
        const lease = client.leases.get(AUTH_USER);
        if (!lease?.unsubscribe) {
            const auth = getAuth(client.firebaseApp);
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    const api = new LeaseeApi(AUTH_USER, entityApi);
                    const data = transform ? transform(api, user) : user;
                    putEntity(client, AUTH_USER, data);
                } else {
                    putEntity(client, AUTH_USER, null);
                    if (onSignedOut) {
                        onSignedOut();
                    }
                }
            }, (error) => {
                putEntity(client, AUTH_USER, error);
            })
            // Create a `PendingTuple` and add it to the cache
            createLeasedEntity(client, unsubscribe, AUTH_USER, AUTH_USER, AUTH_USER_LEASE_OPTIONS);
        }

    }, [client, transform, onSignedOut])
       
    return lookupAuthTuple<UserType>(client);
}

function lookupAuthTuple<UserType>(client: EntityClient): AuthTuple<UserType> {
    const entity = client.cache[AUTH_USER];
    
    return (
        entity===undefined      ? ['pending', undefined, undefined] :
        entity===null           ? ['signedOut', null, undefined] :
        entity instanceof Error ? ['error', undefined, entity as Error] :
                                  ['signedIn', entity as UserType, undefined]
    )
}

export function useEntityApi(): EntityApi {
    return entityApi;
}

export function useAuthUser<UserType=User>() {
    const client = useContext(FirebaseContext);
    
    if (!client) {
        throw new Error(OUTSIDE);
    }
    return lookupEntityTuple<UserType>(client.cache, AUTH_USER);
}

export function useEntity<Type=any>(key: EntityKey) {
    const client = useContext(FirebaseContext);
   
    if (!client) {
        throw new Error(OUTSIDE);
    }
    const validKey = validateKey(key);
    const hashValue = validKey ? hashEntityKey(key) : '';
    return lookupEntityTuple<Type>(client?.cache, hashValue);
}

export function useData<StateType, ReturnType>(selector: (state: StateType) => ReturnType) {

    const client = useContext(FirebaseContext);
    
    if (!client) {
        throw new Error(OUTSIDE);
    }

    const state = client.cache as StateType;
    return selector(state);
}
