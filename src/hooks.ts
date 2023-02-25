import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useContext, useEffect } from "react";
import { DocListenerOptions, lookupEntityTuple, startDocListener, validatePath } from "./common";
import { FirebaseContext } from "./components/FirebaseContext/FirebaseContext";
import { EntityApi } from "./EntityApi";
import { createLeasedEntity, EntityClient } from "./EntityClient";
import { LeaseeApi } from "./LeaseeApi";
import { releaseAllClaims } from "./releaseAllClaims";
import { setEntity } from "./setEntity";
import { AuthTuple, EntityKey, EntityTuple, PathElement } from "./types";
import { hashEntityKey, validateKey } from "./util";

/** The key under which the authenticated user is stored in the EntityCache */
export const CURRENT_USER = 'currentUser';

/** The lease options for the Firebase Auth user */
export const AUTH_USER_LEASE_OPTIONS = {abandonTime: Number.POSITIVE_INFINITY};

/**
 * Use a snapshot listener to retrieve data from a Firestore document.
 * 
 * #### Example 1
 * This example illustrates basic usage without any optional parameters.
 * It assumes you have a Firestore collection named "cities" that contains
 * documents whose data matches the `City` type.
 * ```typescript
 *  interface CityComponentProps {
 *      cityId: string;
 *  }
 *  function CityComponent(props: CityComponentProps) {
 *      const {cityId} = props;
 * 
 *      const [cityStatus, city, cityError] = useDocListener<City>(
 *          "CityComponent", ["cities", cityId]
 *      );
 * 
 *      useReleaseAllClaims("CityComponent");
 * 
 *      switch (cityStatus) {
 *          case "pending":
 *              // The document has not yet been received from Firestore
 *              // The `city` and `cityError` variables are undefined
 *              break;
 * 
 *          case "removed":
 *              // The document was removed from Firestore.
 *              // `city` is null.
 *              // `cityError` is undefined.
 *              break;
 * 
 *          case "error":
 *              // An error occurred while fetching the document from Firestore.
 *              // `city` is undefined.
 *              // `cityError` contains the Error thrown by Firestore.
 *              break;
 * 
 *          case "success":
 *              // The document was successfully retrieved from Firestore.
 *              // `city` contains the document data cast as the `City` type.
 *              // `cityError` is undefined.
 *              break;
 *      }
 *  }
 * ```
 * This example is just a rough skeleton.  A real solution would return an
 * appropriate component for each case in the switch statement.
 * 
 * #### Example 2
 * You can pass optional parameters to `useDocListener` as shown below.
 * ```typescript 
 *      const [cityStatus, city, cityError] = useDocListener(
 *          "SomeComponent", ["cities", cityId], {
 *              transform: cityTransform,
 *              onRemove: handleCityRemove,
 *              onError: handleCityError,
 *              leaseOptions: {abandonTime: 120000}
 *          }
 *      );
 * ```
 * When a `transform` handler is defined, you don't need to specify the `TServer` template
 * parameter because the Typescript complier can infer its value.
 * 
 * See {@link DocListenerOptions} for more information about these optional parameters.
 * 
 * See [useReleaseAllClaims](../functions/useReleaseAllClaims.html) for a discussion about the
 * importance of releasing claims to avoid memory leaks.
 * 
 * @param leasee The name of the component.
 * 
 * The `useDocListener` hook creates a `Lease` for the entity if one does not already
 * exist, and it makes claim on behalf of the client by inserting the value of the
 * `leasee` parameter into the Lease's ledger.
 * 
 * See the [Lease class documentation](../classes/Lease.html) for more information about 
 * making claims.
 *  
 * @param path The path to the document in Firestore, starting with the name of a collection.
 * @param options An object encapsulating optional parameters.
 * 
 * @typeParam TServer The type of data stored in the Firestore document
 * @typeParam TFinal The final type of data to be returned. If a `transform` handler
 *      is provided in the `options`, then `TFinal` is the type of object returned by
 *      that handler.  Otherwise, it is the same as `TServer` by default.
 */
export function useDocListener<
    TServer = unknown,
    TFinal = TServer,
>(
    leasee: string,
    path: PathElement[],
    options?: DocListenerOptions<TServer, TFinal>
) : EntityTuple<TFinal> {

    const client = useClient();

    const validPath = validatePath(path);
    const hashValue = validPath ? hashEntityKey(validPath) : '';

    useEffect( () => {
        startDocListener<TServer, TFinal>(
            client.api, leasee, validPath, hashValue, options
        );

    }, [leasee, hashValue, client, validPath, options])

    return lookupEntityTuple<TFinal>(client.cache, hashValue);
}

/**
 * An object that encapsulates optional event handlers that fire
 * when the authenticated user's state changes.
 */
export interface AuthOptions<Type=User> {

    /** 
     * An event handler that fires when the user is initially signed in 
     * and then later when any of the User properties change.
     * 
     * Typically, this handler will transform the supplied `User` object
     * into a custom structure that merges the Firebase User with data from other
     * sources.  If the other data is not yet avalable, the `transform` handler 
     * should return `undefined` to signal that construction of the custom user 
     * object is pending.
     * 
     * The `transform` handler may also be used as a trigger that produces 
     * side-effects without altering the structure of the user object. In that
     * case, after triggering the side-effects, the `transform` handler simply 
     * returns the `user` that was supplied as the second parameter.
     * 
     * #### Example
     * ```typescript
     *  interface UserPreferences {
     *      langCode: string; // The user's preferred language
     *  }
     * 
     *  interface CustomUser {
     *      // Properties from Firebase user
     *      displayName: string | null;
     *      email: string | null;
     *      phoneNumber: string | null;
     *      photoURL: string | null;
     *      providerId: string;
     *      uid: string;
     *      emailVerified: boolean;
     *      isAnonymous: boolean;
     *      metadata: UserMetadata;
     *      providerData: UserInfo[];
     *      refreshToken: string;
     *      tenantId: string | null;
     *      
     *      // Custom properties
     *      langCode: string
     *  }
     * 
     *  function userTransform(api: LeaseeApi, user: User) {
     * 
     *      [, preferences, preferencesError] = watchEntity(
     *          api, api.leasee, ["preferences", user.uid],
     *          {transform: userPreferencesTransform}
     *      );
     * 
     *      if (preferencesError) {
     *          throw new Error(
     *              "Failed to create customUser", {cause: preferencesError}
     *          );
     *      }
     * 
     *      return preferences ? createCustomUser(user, preferences) : undefined;
     *  }
     * 
     *  function createCustomUser(user: User, preferences: UserPreferences) {
     *      return {
     *          ...user.toJson(),
     *          langCode: preferences.langCode
     *      } as CustomUser
     *  }
     * 
     *  function userPreferencesTransform(
     *      api: LeaseeApi, 
     *      preferences: UserPreferences, 
     *      path: string[]
     *  ) {
     *      const auth = getAuth(api.firebaseApp);
     *      const user = auth.currentUser;
     *      const userUid = path[path.length-1];
     *      if (userUid === user?.uid) {
     *          const customUser = createCustomUser(user, preferences);
     *          setAuthUser(api, customUser);
     *      }
     *      
     *      return preferences;
     *  }
     * ```
     */
    transform?: (api: LeaseeApi, user: User) => Type | undefined;

    /** 
     * A event handler that fires if an error occurs while listening 
     * to state changes to the authenticated user. 
     */
    onError?: (api: LeaseeApi, error: Error) => void;

    /** An event handler that fires when it is known that the user is not signed in */
    onSignedOut?: (api: LeaseeApi) => void;
}


/**
 * 
 * @param options An object containing optional event handlers
 */
export function useAuthListener<UserType = User>(options?: AuthOptions<UserType>) : AuthTuple<UserType> {

    const transform = options?.transform;
    const onError = options?.onError;
    const onSignedOut = options?.onSignedOut;

    const client = useClient();

    const entityApi = client.api;

    useEffect(() => {
        const lease = client.leases.get(CURRENT_USER);
        if (!lease?.unsubscribe) {
            const auth = getAuth(client.firebaseApp);
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    const api = new LeaseeApi(CURRENT_USER, entityApi);
                    const data = transform ? transform(api, user) : user;
                    setEntity(entityApi, CURRENT_USER, data);
                } else {
                    setEntity(entityApi, CURRENT_USER, null);
                    if (onSignedOut) {
                        const api = new LeaseeApi(CURRENT_USER, entityApi);
                        onSignedOut(api);
                    }
                }
            }, (error) => {
                setEntity(entityApi, CURRENT_USER, error);
                if (onError) {
                    const api = new LeaseeApi(CURRENT_USER, entityApi);
                    onError(api, error);
                }
            })
            // Create a `PendingTuple` and add it to the cache
            createLeasedEntity(client, unsubscribe, CURRENT_USER, CURRENT_USER, AUTH_USER_LEASE_OPTIONS);
        }

    }, [client, transform, onSignedOut])
       
    return lookupAuthTuple<UserType>(client);
}

function lookupAuthTuple<UserType>(client: EntityClient): AuthTuple<UserType> {
    const entity = client.cache[CURRENT_USER];
    
    return (
        entity===undefined      ? ['pending', undefined, undefined] :
        entity===null           ? ['signedOut', null, undefined] :
        entity instanceof Error ? ['error', undefined, entity as Error] :
                                  ['signedIn', entity as UserType, undefined]
    )
}

export function useEntityApi(): EntityApi {
    const client = useClient();
    return client.api;
}

export function useAuthUser<UserType=User>() {
    const client = useClient();
    return lookupEntityTuple<UserType>(client.cache, CURRENT_USER);
}

export function useEntity<Type=any>(key: EntityKey) {
    const client = useClient();
    const validKey = validateKey(key);
    const hashValue = validKey ? hashEntityKey(key) : '';
    return lookupEntityTuple<Type>(client?.cache, hashValue);
}

export function useData<StateType, ReturnType>(selector: (state: StateType) => ReturnType) {

    const client = useClient();

    const state = client.cache as StateType;
    return selector(state);
}

/**
 * A hook that releases all claims held by a given component when 
 * that component unmounts.
 * 
 * To avoid memory leaks, this hook should be invoked by all components 
 * that utilize the [useDocListener](./useDocListener.html) hook.
 * 
 * The `useDocListener` hook makes a *claim* on behalf of the component, and hence
 * the document data will not expire from the cache unless that claim is released.
 * 
 * #### Example
 * ```typescript
 *      const [cityStatus, city, cityError] = useDocListener<City>(
 *          "CityComponent", ["cities", cityId]
 *      );
 * 
 *      useReleaseAllClaims("CityComponent");
 * ```
 * 
 * See [Lease](../classes/Lease.html) for more information about claims.
 * 
 * @param leasee The name of the component
 */
export function useReleaseAllClaims(leasee: string) {
    
    const client = useClient();
    useEffect(() => () => releaseAllClaims(client.api, leasee), []);
}

function useClient() {
    const client = useContext(FirebaseContext);
    if (!client) {
        throw new Error("FirebaseContext was used outside of a provider");
    }

    return client;
}
