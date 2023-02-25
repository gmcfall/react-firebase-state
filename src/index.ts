export { EntityClient } from "./EntityClient";
export type { EntityApi } from "./EntityApi";
export type { Lease } from "./Lease";
export { LeaseeApi } from "./LeaseeApi";

export { FirebaseProvider } from "./components/FirebaseContext";

export type { FirebaseProviderProps } from "./components/FirebaseContext";

export {
    useAuthListener,
    useAuthUser,
    useDocListener,
    useData,
    useEntity,
    useEntityApi,
    useReleaseAllClaims,
    CURRENT_USER,
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

export type {
    AuthStatus,
    AuthTuple,
    Entity,
    Cache,
    EntityClientOptions,
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
    RemovedTuple,
    SuccessTuple,
    Unsubscribe
} from "./types";
