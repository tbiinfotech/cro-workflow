import {
  IntelligemsHydrogenProvider,
  useIgTrack,
} from "@intelligems/headless/hydrogen";
import { ClientOnly } from "remix-utils/client-only";

const IgTrack = ({ cartOrCheckoutToken, currency, country }) => {
  useIgTrack({
    cartOrCheckoutToken,
    currency,
    country,
  });
  return null;
};

export const wrapRootElement = ({ element }) => {
  return (
    <IntelligemsHydrogenProvider
      organizationId={'05535b3d-6216-450a-ab6c-b678dd995808'}
      storefrontApiToken={process.env.STOREFRONT_ACCESS_TOKEN}
      antiFlicker={true}
    >
      {/* <StoreProvider> */}
        <ClientOnly>{() => <IgTrack />}</ClientOnly>
        {element}
      {/* </StoreProvider> */}
    </IntelligemsHydrogenProvider>
  );
};
