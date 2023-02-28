import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useContext, useEffect } from "react";
import { CURRENT_USER, DocListenerOptions, lookupAuthTuple, lookupEntityTuple, startDocListener, validatePath } from "./common";
import { FirebaseContext } from "./components/FirebaseContext/FirebaseContext";
import { EntityApi } from "./EntityApi";
import { createLeasedEntity } from "./EntityClient";
import { releaseAllClaims } from "./releaseAllClaims";
import { setEntity } from "./setEntity";
import { AuthErrorEvent, AuthTuple, AuthTupleOrIdle, EntityKey, EntityTuple, PathElement, UserChangeEvent, UserSignedOutEvent } from "./types";
import { hashEntityKey, validateKey } from "./util";


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
 *      const [city, cityError, cityStatus] = useDocListener<City>(
 *          "CityComponent", ["cities", cityId]
 *      );
 * 
 *      useReleaseAllClaims("CityComponent");
 * 
 *      switch (cityStatus) {
 *          case "idle" :
 *              // The path passed to `useDocListener` contains an undefined
 *              // value, and therefore a document listener was not started
 *              // `city` and `cityError` are both undefined.
 *              break;
 * 
 *          case "pending":
 *              // The document has not yet been received from Firestore
 *              // The `city` and `cityError` are both undefined
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
 * This example is just a rough skeleton.  A proper implementation would return an
 * appropriate component for each case in the switch statement.
 * 
 * #### Example 2
 * The second argument to `useDocListener` is the path to the document. 
 * If any element in the path is `undefined`, then `startDocListener` 
 * returns an [IdleTuple](../types/IdleTuple.html). This is useful if the path 
 * depends on other entities that might not be available yet.
 * 
 * Suppose, for instance, that your application has documents that store information
 * about city councillors in a Firestore collection named "councillors".
 * 
 * A component that renders information about the councillor and the city
 * might use document listeners for both entities like this:
 * ```typescript
 *  function CouncillorComponent({councillorId}) {
 *      const [councillor, councillorError, councillorStatus] = 
 *          useDocListener<Councillor>(
 *              "CouncillorComponent", ["councillors", councillorId]
 *          );
 *      const [city, cityError, cityStatus] = useDocListener<City>(
 *          "CityComponent", ["cities", councillor?.cityId]
 *      );
 * 
 *      useReleaseAllClaims("CityComponent");
 * 
 *      // ...
 *  }
 * ```
 * If the `councillor` value is `undefined`, then `cityStatus` will be "idle".
 * 
 * #### Example 3
 * You can pass optional parameters to `useDocListener` as shown below.
 * ```typescript 
 *      const [city, cityError, cityStatus] = useDocListener(
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
 *  Each element in the path is a string or the `undefined` value. The `undefined` value 
 *  signals that the given path element is not currently available. In this case,
 *  `startDocListener` returns an [IdleTuple](../types/IdleTuple.html).
 *  
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
     * An event handler called when the user is initially signed in 
     * and then later when any of the User properties change.
     * 
     * Typically, this handler will transform the supplied Firebase `User` object
     * into a custom structure that merges the Firebase User with data from other
     * sources.  If the other data is not yet avalable, the `transform` handler 
     * should return `undefined` to signal that construction of the custom user 
     * object is pending.
     * 
     * The `transform` handler may also be used as a trigger that produces 
     * side-effects without altering the structure of the user object. In that
     * case, after triggering the side-effects, the `transform` handler simply 
     * returns the `user` that was supplied in the event.
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
     *  function userTransform(event: UserChangeEvent) {
     *      const user = event.user;
     *      [preferences, preferencesError] = watchEntity(
     *          api, api.leasee, ["preferences", user.uid],
     *          {transform: userPreferencesTransform}
     *      );
     * 
     *      if (preferencesError) {
     *          throw new Error(
     *              "Failed to create CustomUser", {cause: preferencesError}
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
     *  function userPreferencesTransform(event: DocChangeEvent<UserPreferences>) {
     *      const api = event.api;
     *      const path = event.path;
     *      const preferences = event.data;
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
    transform?: (event: UserChangeEvent) => Type | undefined;

    /** 
     * A event handler called if an error occurs while listening 
     * to state changes to the authenticated user. 
     */
    onError?: (event: AuthErrorEvent) => void;

    /** An event handler called when it is known that the user is not signed in */
    onSignedOut?: (event: UserSignedOutEvent) => void;
}


/**
 * Use a Firestore authentication listener to get information about the current user.
 * 
 * #### Example 1
 * This example illustrates basic usage without any optional parameters.
 * ```typescript
 *  function SomeComponent() {
 *      const [user, userError, userStatus] = useAuthListener();
 * 
 *      switch (userStatus) {
 * 
 *          case "pending": *          
 *              // The state of the current user has been requested
 *              // but a response has not yet been received from Firebase.
 *              // `user` and `userError` are both undefined.
 *              break;
 * 
 *          case "signedIn":
 *              // The user has been authenticated.
 *              // `user` is the the `currentUser` from Firebase Auth.
 *              // `userError` is undefined.
 *              break;
 * 
 *          case "signedOut":
 *              // Firebase responded that the user is not currently signed in.
 *              // `user` is null.
 *              // `userError` is undefined.
 *              break;
 * 
 *          case "error":
 *              // An error occurred while fetch the state of the current user.
 *              // `user` is undefined.
 *              // `error` is the Error returned by Firebase.
 *              break;
 *      }
 *  }
 * ```
 * This example is just a rough skeleton. A proper implementation would return
 * an appropriate component for each case in the switch statement.
 * 
 * #### Example 2
 * You can pass optional parameters to `useAuthListener` as shown below.
 * ```typescript
 *  const [user, userError, userStatus] = useAuthListener({
 *      transform: userTransform,
 *      onError: handleUserError,
 *      onSignedOut: handlUserSignedOut
 *  })
 * ```
 * 
 * See {@link AuthOptions} for more information about these optional parameters.
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
                    try {
                        const data = transform ? transform({
                            api: entityApi,
                            leasee: CURRENT_USER,
                            user
                        }) : user;
                        setEntity(entityApi, CURRENT_USER, data);
                    } catch (transformError) {
                        setEntity(entityApi, CURRENT_USER, transformError)
                    }
                } else {
                    setEntity(entityApi, CURRENT_USER, null);
                    if (onSignedOut) {
                        onSignedOut({api: entityApi, leasee: CURRENT_USER});
                    }
                }
            }, (error) => {
                setEntity(entityApi, CURRENT_USER, error);
                if (onError) {
                    onError({api: entityApi, error, leasee: CURRENT_USER});
                }
            })
            // Create a `PendingTuple` and add it to the cache
            createLeasedEntity(client, unsubscribe, CURRENT_USER, CURRENT_USER, AUTH_USER_LEASE_OPTIONS);
        }

    }, [client, transform, onSignedOut])
       
    return lookupAuthTuple<UserType>(client.cache);
}

export function useEntityApi(): EntityApi {
    const client = useClient();
    return client.api;
}

/**
 * Get information about the currently authenticated user.
 * 
 * @returns 
 */
export function useAuthUser<UserType=User>(): AuthTupleOrIdle<UserType> {
    const client = useClient();

    const lease = client.leases.get(CURRENT_USER);
    if (!lease) {
        return [undefined, undefined, "idle"];
    }
    
    return lookupAuthTuple<UserType>(client.cache);
}

/**
 * Get information about an entity stored in the cache.
 * @param key The key under which the entity is stored in the cache
 * @returns 
 */
export function useEntity<Type=any>(key: EntityKey) {
    const client = useClient();
    const validKey = validateKey(key);
    const hashValue = validKey ? hashEntityKey(key) : '';
    return lookupEntityTuple<Type>(client?.cache, hashValue);
}

/**
 * Allows you to extract client-side data from the cache.
 * 
 * #### Example
 * Suppose your application can display alert notifications.
 * 
 * You might define a `MyApp` interface for your application's client-side
 * state like this:
 * ```typescript * 
 *  type Severity = "error" | "warning" | "info" | "success";
 * 
 *  interface AlertInfo {
 *      severity: Severity;
 *      message: string;
 *  }
 * 
 *  interface MyApp {
 *      alertInfo?: AlertInfo;
 *  }
 * ```
 * Your React components would access the AlertInfo like this: 
 * ```typescript
 *  const alertInfo = useData((app: MyApp) => app.alertInfo);
 * ```
 * 
 * Applications use the {@link EntityApi.mutate} method of {@link EntityApi}
 * to modify client-side state.
 * 
 * @param selector A function that extracts data from the cache.
 * 
 * @typeParam StateType The type of your application's client-side state. You don't
 *  need to set this template parameter explicitly; it will be inferred from the selector.
 * 
 * @typeParam ReturnType The type of data returned by the `useData` hook. You don't
 *  need to set this template parameter explicitly; it will be inferred from the selector.
 * 
 * @returns The data extracted via the supplied `selector` function.
 */
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
 *      const [city, cityError, cityStatus] = useDocListener<City>(
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
