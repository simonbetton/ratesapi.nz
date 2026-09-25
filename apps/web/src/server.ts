import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { canonicalRedirect } from "./lib/canonical-url";

export default createServerEntry({
  fetch(request, ...rest) {
    const location = canonicalRedirect(request.url);
    if (location !== null) {
      return Response.redirect(location, 301);
    }

    return handler.fetch(request, ...rest);
  },
});
