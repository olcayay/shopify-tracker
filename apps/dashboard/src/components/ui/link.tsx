import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * Wrapper around next/link that defaults prefetch to false.
 * Next.js eagerly prefetches RSC data for every visible <Link>,
 * which causes a storm of requests on pages with many links (sidebar, overview, etc.).
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={props.prefetch ?? false} />;
}
