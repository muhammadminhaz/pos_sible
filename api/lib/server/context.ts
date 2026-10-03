import { AsyncLocalStorage } from "node:async_hooks";
import { dataContext, type DataContext } from "@/lib/data/store/db";

/** One data context per request, so concurrent requests can never see each other's working copy. */
export const requestContext = new AsyncLocalStorage<DataContext>();

dataContext.current = () => requestContext.getStore();
