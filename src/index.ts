/**
 * See the {@link EntityApi} interface for an overview of the capabilities
 * of this library.
 * 
 * @packageDocumentation
 */

export { EntityClient } from "./EntityClient";
export type { EntityApi } from "./EntityApi";
export type { Lease } from "./Lease";

export { FirebaseProvider } from "./components/FirebaseContext";

export type { FirebaseProviderProps } from "./components/FirebaseContext";

export {
    useAuthListener,
    useAuthUser,
    useDocListener,
    useData,
    useEntity,
    useEntityApi,
    useReleaseAllClaims
} from "./hooks";

export type { AuthOptions } from "./hooks";

export {
    watchEntity,
    setLeasedEntity,
    getAuthUser,
    setAuthUser,
    getEntity,
    releaseClaim
} from "./functions";

export { releaseAllClaims } from "./releaseAllClaims";

export { setEntity } from "./setEntity"

export type { DocListenerOptions } from "./common";

export { CURRENT_USER } from "./common";

export type {
    AuthErrorEvent,
    AuthStatus,
    AuthTuple,
    Entity,
    Cache,
    DocEvent,
    DocChangeEvent,
    DocErrorEvent,
    DocMutationEvent,
    DocRemovedEvent,
    EntityApiOptions,
    EntityKey,
    EntityStatus,
    EntityTuple,
    ErrorTuple,
    IdleTuple,
    LeaseOptions,
    PathElement,
    PendingTuple,
    SignedInTuple,
    SignedOutTuple,
    ReactFirebaseEvent,
    RemovedTuple,
    SuccessTuple,
    Unsubscribe,
    UserChangeEvent,
    UserSignedOutEvent
} from "./types";
