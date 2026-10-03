import { NotFoundView } from "@/components/shared/NotFoundView";

/** Unmatched URLs anywhere on the site (the (app) group's not-found only covers `notFound()` calls). */
export default function RootNotFound() {
  return <NotFoundView page />;
}
