import { User } from "firebase/auth";
import { CURRENT_USER, DocListenerOptions, lookupAuthTuple, lookupEntityTuple, startDocListener, validatePath } from "./common";
import { EntityApi } from "./EntityApi";
import { claimLease, EntityClient, removeLeaseeFromLease } from "./EntityClient";
import { setEntity } from "./setEntity";
import { AuthTuple, Cache, EntityKey, EntityTuple, IdleTuple, LeaseOptions, PathElement } from "./types";
import { hashEntityKey, toHashValue } from "./util";


/**
 * A function providing the same functionality as the `useDocListener`
 * hook but designed for use within `useEffect` and event handlers.
 * The only difference from `useDocListener` is that you need to pass an {@link EntityApi} 
 * as the first parameter.
 * 
 * See [useDocListener](./useDocListener.html) for usage instructions. The usage of this function
 * is similar.
 * 
 * See also the [AuthOptions](../interfaces/AuthOptions.html#example) for an explicit example showing 
 * the use of `watchEntity` inside a `transform` handler.
 * 
 * @param api An EntityApi instance
 * @param leasee The name of the leasee that is claiming a lease on the watched entity
 * @param path The path to the document to be watched. If any element of the path is `undefined`,
 *      this function does nothing and returns `[idle, undefined, undefined]`.
 * @param options options for the document listener
 * 
 * @returns A Tuple describing the entity being watched.
 */
export function watchEntity<
    TRaw = unknown,
    TFinal = TRaw
>(
    api: EntityApi,
    leasee: string,
    path: PathElement[],
    options?: DocListenerOptions<TRaw, TFinal>
) {
    const validPath = validatePath(path);
    const hashValue = validPath ? hashEntityKey(path) : "";

    startDocListener<TRaw, TFinal>(api, leasee, validPath, hashValue, options);

    const cache = api.getClient().cache;

    return lookupEntityTuple<TFinal>(cache, hashValue);
}



/**
 * Insert or update the data value for some entity in the cache.
 * 
 * If a `Lease` for the entity does not already exist, this function
 * will create one with the given options.
 * 
 * This function makes a claim on the entity by adding the specified
 * leasee to the Lease's ledger.
 * 
 * See the [Lease documentation](../classes/Lease.html) for a discussion
 * about claims.
 * 
 * @param api An EntityApi instance
 * @param leasee The name of the component making a claim on the entity
 * @param key The key under which the entity is stored
 * @param value The data value to be stored in the cache
 * @param options Options for the Lease if a new Lease is created.
 */
export function setLeasedEntity(
    api: EntityApi, 
    leasee: string, 
    key: string | EntityKey, 
    value: unknown, 
    options?: LeaseOptions
) {

    const hashValue = toHashValue(key);
    if (hashValue) {
        setEntity(api, hashValue, value);
        claimLease(api.getClient(), hashValue, leasee, options);
    }
}

/**
 * Get information about the authenticated user from the cache.
 * 
 * By default, the authenticated user is the `currentUser`
 * from Firebase Auth, but it may be a custom user object.
 * 
 * For a discussion about custom user objects, see the documentation for the
 * [transform](../interfaces/AuthOptions.html#transform) handler in 
 * [AuthOptions](../interfaces/AuthOptions.html).
 * 
 * #### Example 1
 * In this example, `getAuthUser` is used inside an event handler.
 * 
 * ```typescript
 *  const api = useEntityApi();
 * 
 *  function handleClick() {
 *      const [user, userError, userStatus] = getAuthUser(api);
 *      // Do something with the user
 *  }
 * ```
 * 
 * #### Example 2
 * In this example, `getAuthUser` is used inside the {@link EntityApi.mutate} 
 * function.
 * 
 * ```typescript
 *  entityApi.mutate(
 *      (app: MyAppType) => {
 *          const [user, userError, userStatus] = getAuthUser(app as Cache);
 *          // Make changes to client-side data here.
 *      }
 *  )
 * ```
 * @param entityProvider An EntityApi instance or the Cache.
 * @typeParam UserType The user type. By default, this is the `User` type from Firebase Auth.
 *      The data value in the returned tuple is cast to this type.
 * @returns An `AuthTuple` for the authenticated user or `IdleTuple` if an auth listener
 * has not been started.
 */
export function getAuthUser<UserType=User>(entityProvider: EntityApi | Cache): 
    AuthTuple<UserType> | IdleTuple
{
    if ("getClient" in entityProvider) {
        const api = entityProvider as EntityApi;
        const client = api.getClient();
        const lease = client.leases.get(CURRENT_USER);
        if (!lease) {
            return [undefined, undefined, "idle"];
        }
        return lookupAuthTuple<UserType>(client.cache);
    } else {
        const cache = entityProvider as Cache;
        if (!(CURRENT_USER in cache)) {
            return [undefined, undefined, "idle"];
        }
        return lookupAuthTuple(cache);
    }
}

/**
 * Set the value of the current user in the cache.
 * 
 * The value is placed into the cache under the {@link CURRENT_USER} key.
 * 
 * Applications that use the default user provided by Firebase won't have
 * a need for this function. They can simply let the auth listener automatically 
 * update the cache asynchronously.
 * 
 * #### Example 1
 * 
 * Applications that use a *custom* user object will typically call `setUser`
 * from within a `transform` handler.  For more information about custom users
 * and an example illustrating the usage pattern, see the 
 * [transform](../interfaces/AuthOptions.html#transform) documentation.
 * 
 * Most applications with a custom user will follow this usage pattern.
 * However, if latency is an issue, they may also call `setAuthUser` to update the cache 
 * immediately as shown in the following example.
 * 
 * #### Example 2
 * In this example, the application defines a custom user type that enhances the Firebase user
 * with a `langCode` property for the user's preferred language. The snippet shows how one
 * might update `displayName` and `langCode` from a *UserProfileForm*. When the form is
 * submitted, an event handler uses `setAuthUser` to update the value of the current user 
 * in the cache immediately.
 * ```typescript
 *  interface UserProfileForm {
 *      currentUser: CustomUserType;
 *  }
 *  function UserProfileForm(props: UserProfileForm) {
 *      const {currentUser} = props;
 *      const api = useEntityApi();
 *      const [displayName, setDisplayName] = useState(currentUser.displayName);
 *      const [langCode, setLangCode] = useState(currentUser.langCode);
 * 
 *      function handleSubmit() {
 *          if (displayName !== currentUser.displayName) {
 *              const auth = getAuth(api.firebaseApp);
 *              updateProfile(auth.currentUser, {displayName});
 *          }
 *          if (langCode !== currentUser.langCode) {
 *              const db = getFirestore(api.firebaseApp);
 *              const docRef = doc(db, "preferences", currentUser.uid);
 *              updateDoc(docRef, {langCode});
 *          }
 * 
 *          // Most applications will allow a `transform` handler to
 *          // update the cache as discussed in Example 1 above.
 *          // However, if latency is an issue, you can update the user
 *          // object in the cache immediately as shown here:
 * 
 *          const newUser = {...currentUser, displayName, langCode};
 *          setAuthUser(api, newUser);
 *      }
 * 
 *      // ... The rest of this component's implementation is omitted for brevity ...
 *  }
 * ```
 * &nbsp;
 * #### Example 3
 * As shown below, it is possible to invoke `setAuthUser` from inside the {@link EntityApi.mutate}
 * method of {@link EntityApi}.
 * ```typescript
 *  entityApi.mutate(
 *      (app: MyCustomAppType) => {
 * 
 *          // Make some client-side state changes and create
 *          // an `updatedUserObject`.
 * 
 *          setAuthUser(app as Cache, updatedUserObject);
 *      }
 *  )
 * ```
 * 
 * @param entityProvider An EntityApi instance or the Cache
 * @param value The value for the current user that will be set in the cache.
 */
export function setAuthUser(entityProvider: EntityApi | Cache, value: unknown) {
    setEntity(entityProvider, CURRENT_USER, value);
}

function resolveCache(value: object) {
    return (
        value.hasOwnProperty('cache') ? (value as EntityClient).cache :
        (value as any).getClient ? (value as EntityApi).getClient().cache :
        value as Cache
    )
}


/**
 * Get information about an entity in the cache.
 * 
 * `getEntity` provides the same functionality as [useEntity](./useEntity.html),
 * except it is designed for use inside `useEffect` and event handlers.
 * 
 * #### Example 1
 * This example invokes `getEntity` from within an event handler.
 * ```typescript
 *  function SomeComponent({cityId}) {
 *      const api = useEntityApi();
 * 
 *      function handleClick() {
 *          const path = ["cities", cityId];
 *          const [city, cityError, cityStatus] = getEntity<City>(api, path); * 
 *          // Do something with the city information
 *      }
 *      // ... The rest of this component's implementation is omitted for brevity ...
 *  }
 * ```
 * &nbsp;
 * #### Example 2
 * This example invokes `getEntity` from within the {@link EntityApi.mutate}
 * method of {@link EntityApi} as shown below.
 * ```typescript
 *  entityApi.mutate(
 *      (app: MyAppType) => {
 *          // ... Make some client-side state changes ...
 * 
 *          const path = ["cities", cityId];
 *          [city, cityError, cityStatus] = getEntity<City>(app as Cache, path);
 *          
 *          // ... Do something with the city information ...
 *      }
 *  )
 * ```
 * 
 * @param entityProvider An EntityApi instance or the cache
 * @param entityKey The key under which the entity is stored in the cache
 * @typeParam Type The entity's type. The data value in the returned EntityTuple is
 *  cast to this type.
 * @returns An EntityTuple describing the requested entity.
 */
export function getEntity<Type>(entityProvider: EntityApi | Cache, key: string | EntityKey): EntityTuple<Type> {
    const hashValue = toHashValue(key);
    if (hashValue) {
        if ("getClient" in entityProvider) {
            const api = entityProvider as EntityApi;
            const client = api.getClient();
            const lease = client.leases.get(hashValue);
            if (!lease || !lease.unsubscribe) {
                return [undefined, undefined, "idle"];
            }
        } else {
            const cache = entityProvider as Cache;
            if (!cache.hasOwnProperty(hashValue)) {
                return [undefined, undefined, "idle"];
            }
        }
    }
    const cache = resolveCache(entityProvider);
    return lookupEntityTuple<Type>(cache, hashValue);
}

export function getClientState<T>(client: EntityClient) {
    return client.cache as T
}

export interface TypedClientStateGetter<T> {
    (client: EntityClient): T
}

/**
 * Release the claim that a leasee has on a specific entity within the cache.
 * 
 * See the documentation for the [Lease](../classes/Lease.html) class for
 * a discussion about claims.
 * 
 * @param api An EntityApi instance
 * @param leasee The name of the component holding the claim
 * @param key The key under which the entity is stored in the cache
 */
export function releaseClaim(api: EntityApi, leasee: string, key: string | EntityKey) {

    const hashValue = toHashValue(key);
    if (hashValue !== null) {
        const client = api.getClient();
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

