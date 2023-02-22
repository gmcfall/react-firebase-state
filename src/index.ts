export { EntityClient } from "./EntityClient";
export type { EntityApi } from "./EntityApi";
export { Lease } from "./Lease";
export { LeaseeApi } from "./LeaseeApi";

export { FirebaseProvider } from "./components/FirebaseContext"

export {
    useAuthListener,
    useAuthUser,
    useDocListener,
    useData,
    useEntity,
    useEntityApi,
    CURRENT_USER,
} from "./hooks";

export type { AuthOptions } from "./hooks";

export {
    watchEntity,
    setLeasedEntity,
    getAuthUser,
    setAuthUser,
    getEntity,
    fetchEntity,
    releaseClaim,
    disownAllLeases
} from "./functions";

export { releaseEntities } from "./releaseEntities";

export { setEntity } from "./setEntity"

export type { ListenerOptions } from "./common";

export type {
    AuthStatus,
    AuthTuple,
    Entity,
    EntityCache,
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
    SuccessTuple
} from "./types";
